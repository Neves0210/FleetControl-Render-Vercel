from pydantic import BaseModel
from typing import Any, Optional


class NfceResponse(BaseModel):
    sucesso: bool
    metodo: str
    chaveAcesso: Optional[str] = None
    urlConsulta: Optional[str] = None
    dadosExtraidos: dict[str, Any] = {}
    confianca: float = 0
    mensagem: Optional[str] = None
