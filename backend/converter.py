"""Converte PDF/DOCX para Markdown com o Docling.

Uso: python converter.py <entrada> <saida.md>

Limites do processamento (descritos no TCC, Seção 2.2):
- PDF digitalizado: OCR ligado (português e inglês). Páginas que já têm texto
  usam o texto do próprio PDF.
- Tabelas: reconhecidas pelo modelo de estrutura de tabelas do Docling e
  exportadas como tabelas Markdown.
- Imagens: não são descritas nem salvas; viram o marcador <!-- image -->.
- Metadados: só os de origem (nome do arquivo, tipo, hash, nº de páginas).
  Título, autor e data internos do arquivo não são extraídos.
- Falha: conversão com erro, parcial (ex.: tempo esgotado no meio) ou sem
  texto útil é recusada — nada é gravado em <saida.md>.

A saída é UMA linha JSON no stdout, lida pelo backend (rag.js):
  {"status": "SUCESSO", "paginas": 3, "tabelas": 1, ...}
  {"status": "ERRO", "motivo": "..."}
"""
import json
import os
import sys
import time

MAX_PAGINAS = 500                  # documentos maiores são recusados
MAX_BYTES = 50 * 1024 * 1024       # mesmo limite do upload (50 MB)
TEMPO_MAX_S = 300                  # por documento
MIN_CARACTERES_UTEIS = 50          # igual a rag.js


def pico_memoria_mb():
    """Pico de memória deste processo (Docling + modelos), em MB."""
    try:
        import resource
        pico = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(pico / (1024 * 1024) if sys.platform == "darwin" else pico / 1024, 1)
    except ImportError:
        pass
    try:  # Windows
        import ctypes
        from ctypes import wintypes

        class Contadores(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                        ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]

        kernel32, psapi = ctypes.windll.kernel32, ctypes.windll.psapi
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Contadores), wintypes.DWORD]
        c = Contadores()
        c.cb = ctypes.sizeof(Contadores)
        if psapi.GetProcessMemoryInfo(kernel32.GetCurrentProcess(), ctypes.byref(c), c.cb):
            return round(c.PeakWorkingSetSize / (1024 * 1024), 1)
    except Exception:
        pass
    return None


def responder(dados, codigo=0):
    dados.setdefault("memoria_pico_mb", pico_memoria_mb())
    print(json.dumps(dados, ensure_ascii=False))
    sys.stdout.flush()
    sys.exit(codigo)


def montar_conversor():
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opcoes = PdfPipelineOptions()
    opcoes.do_ocr = True
    opcoes.do_table_structure = True
    opcoes.generate_picture_images = False
    opcoes.generate_page_images = False
    if hasattr(opcoes, "do_picture_description"):
        opcoes.do_picture_description = False
    if hasattr(opcoes, "document_timeout"):
        opcoes.document_timeout = TEMPO_MAX_S

    # EasyOCR reconhece português; se não estiver instalado
    # (pip install "docling[easyocr]"), o Docling escolhe o motor disponível.
    motor_ocr = "automático (Docling)"
    try:
        from docling.datamodel.pipeline_options import EasyOcrOptions
        import easyocr  # noqa: F401  (só confirma que está instalado)
        opcoes.ocr_options = EasyOcrOptions(lang=["pt", "en"])
        motor_ocr = "EasyOCR (pt, en)"
    except Exception:
        pass

    conversor = DocumentConverter(
        allowed_formats=[InputFormat.PDF, InputFormat.DOCX],
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opcoes)},
    )
    return conversor, motor_ocr


def converter(entrada, saida):
    ext = os.path.splitext(entrada)[1].lower()
    if ext not in (".pdf", ".docx"):
        responder({"status": "ERRO", "motivo": f"Formato {ext or '(sem extensão)'} não é convertido pelo Docling."}, 2)
    if not os.path.isfile(entrada):
        responder({"status": "ERRO", "motivo": "Arquivo de entrada não encontrado."}, 2)

    tamanho = os.path.getsize(entrada)
    if tamanho > MAX_BYTES:
        responder({"status": "ERRO", "motivo": "Arquivo maior que 50 MB."}, 2)

    try:
        from docling.datamodel.base_models import ConversionStatus
        conversor, motor_ocr = montar_conversor()
    except ImportError as e:
        responder({"status": "ERRO", "motivo": f"Docling não instalado ({e.name})."}, 3)

    inicio = time.perf_counter()
    try:
        resultado = conversor.convert(
            entrada, raises_on_error=False, max_num_pages=MAX_PAGINAS, max_file_size=MAX_BYTES
        )
    except Exception as e:  # erro inesperado do próprio Docling
        responder({"status": "ERRO", "motivo": f"Falha na conversão: {e}"[:300]}, 1)
    tempo = round(time.perf_counter() - inicio, 2)

    status = resultado.status
    if status != ConversionStatus.SUCCESS:
        erros = "; ".join(str(getattr(e, "error_message", e)) for e in (resultado.errors or []))[:300]
        motivo = "Conversão parcial (parte do documento não foi lida)" if status == ConversionStatus.PARTIAL_SUCCESS \
            else "Conversão falhou"
        responder({"status": "ERRO", "motivo": f"{motivo}{': ' + erros if erros else ''}.", "tempo_s": tempo}, 1)

    doc = resultado.document
    markdown = doc.export_to_markdown()
    uteis = len("".join(markdown.split()))
    if uteis < MIN_CARACTERES_UTEIS:
        responder({"status": "ERRO", "motivo": "Nenhum texto extraível no documento.", "tempo_s": tempo}, 1)

    with open(saida, "w", encoding="utf-8") as f:
        f.write(markdown)

    origem = getattr(doc, "origin", None)
    responder({
        "status": "SUCESSO",
        "formato": ext[1:].upper(),
        "paginas": len(getattr(doc, "pages", {}) or {}),
        "tabelas": len(getattr(doc, "tables", []) or []),
        "imagens": len(getattr(doc, "pictures", []) or []),
        "caracteres": len(markdown),
        "bytes": tamanho,
        "tempo_s": tempo,
        "ocr": motor_ocr,
        "mimetype": getattr(origem, "mimetype", None),
        "hash": str(getattr(origem, "binary_hash", "")) or None,
    })


if __name__ == "__main__":
    if len(sys.argv) < 3:
        responder({"status": "ERRO", "motivo": "Faltam argumentos (entrada e saída)."}, 2)
    converter(sys.argv[1], sys.argv[2])
