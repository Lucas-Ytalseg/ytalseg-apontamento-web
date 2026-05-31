"""
YTALSEG Apontamento - Backend Web com login (FastAPI + SQLite).
- Login individual; somente admin cadastra/edita/remove usuarios.
- Senhas guardadas com hash (nunca em texto puro).
- Dados em DATA_DIR (Volume do Railway) para nao sumir em redeploy.
"""
import os
import sqlite3
import hashlib
import secrets
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------- Configuracao de pastas ----------
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# DATA_DIR aponta para o Volume do Railway (ex: /data). Localmente usa ./data.
_base_data = os.getenv("DATA_DIR") or str(BASE_DIR)
DATA_DIR = Path(_base_data) / "YTALSEG_APONTAMENTO"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "apontamento.db"

# Admin inicial (criado automaticamente na primeira vez)
ADMIN_INICIAL_USER = os.getenv("ADMIN_USER", "lucasytalseg")
ADMIN_INICIAL_SENHA = os.getenv("ADMIN_SENHA", "l123")


# ---------- Banco de dados ----------
def conectar():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_senha(senha: str, salt: str) -> str:
    return hashlib.sha256((salt + senha).encode("utf-8")).hexdigest()


def init_db():
    conn = conectar()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE NOT NULL,
            nome TEXT,
            senha_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            perfil TEXT NOT NULL DEFAULT 'usuario',
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessoes (
            token TEXT PRIMARY KEY,
            usuario TEXT NOT NULL,
            criado_em TEXT
        )
        """
    )
    conn.commit()

    # Cria admin inicial se ainda nao existir nenhum usuario
    n = conn.execute("SELECT COUNT(*) AS c FROM usuarios").fetchone()["c"]
    if n == 0:
        salt = secrets.token_hex(16)
        conn.execute(
            "INSERT INTO usuarios (usuario, nome, senha_hash, salt, perfil, ativo, criado_em) VALUES (?,?,?,?,?,1,?)",
            (
                ADMIN_INICIAL_USER.strip().lower(),
                "Administrador",
                hash_senha(ADMIN_INICIAL_SENHA, salt),
                salt,
                "admin",
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
    conn.close()


# ---------- App ----------
app = FastAPI(title="YTALSEG Apontamento")


@app.on_event("startup")
def _startup():
    init_db()


# ---------- Modelos ----------
class LoginPayload(BaseModel):
    usuario: str
    senha: str


class NovoUsuarioPayload(BaseModel):
    usuario: str
    nome: str = ""
    senha: str
    perfil: str = "usuario"


class TrocarSenhaPayload(BaseModel):
    usuario: str
    nova_senha: str


# ---------- Autenticacao por token ----------
def usuario_do_token(token: str):
    if not token:
        return None
    conn = conectar()
    row = conn.execute("SELECT usuario FROM sessoes WHERE token = ?", (token,)).fetchone()
    if not row:
        conn.close()
        return None
    u = conn.execute(
        "SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1", (row["usuario"],)
    ).fetchone()
    conn.close()
    return u


def exigir_login(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    u = usuario_do_token(token)
    if not u:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    return u


def exigir_admin(u=Depends(exigir_login)):
    if u["perfil"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas o administrador pode fazer isso")
    return u


# ---------- Rotas de autenticacao ----------
@app.post("/api/login")
def login(payload: LoginPayload):
    conn = conectar()
    u = conn.execute(
        "SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1",
        (payload.usuario.strip().lower(),),
    ).fetchone()
    if not u or hash_senha(payload.senha, u["salt"]) != u["senha_hash"]:
        conn.close()
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos")
    token = secrets.token_hex(24)
    conn.execute(
        "INSERT INTO sessoes (token, usuario, criado_em) VALUES (?,?,?)",
        (token, u["usuario"], datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "token": token, "usuario": u["usuario"], "nome": u["nome"], "perfil": u["perfil"]}


@app.post("/api/logout")
def logout(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    conn = conectar()
    conn.execute("DELETE FROM sessoes WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.get("/api/eu")
def eu(u=Depends(exigir_login)):
    return {"status": "ok", "usuario": u["usuario"], "nome": u["nome"], "perfil": u["perfil"]}


# ---------- Rotas de admin (gerenciar usuarios) ----------
@app.get("/api/usuarios")
def listar_usuarios(u=Depends(exigir_admin)):
    conn = conectar()
    rows = conn.execute(
        "SELECT usuario, nome, perfil, ativo, criado_em FROM usuarios ORDER BY usuario"
    ).fetchall()
    conn.close()
    return {"status": "ok", "usuarios": [dict(r) for r in rows]}


@app.post("/api/usuarios")
def criar_usuario(payload: NovoUsuarioPayload, u=Depends(exigir_admin)):
    nome_user = payload.usuario.strip().lower()
    if not nome_user or not payload.senha:
        raise HTTPException(status_code=400, detail="Usuario e senha sao obrigatorios")
    perfil = "admin" if payload.perfil == "admin" else "usuario"
    salt = secrets.token_hex(16)
    conn = conectar()
    existe = conn.execute("SELECT 1 FROM usuarios WHERE usuario = ?", (nome_user,)).fetchone()
    if existe:
        conn.close()
        raise HTTPException(status_code=400, detail="Esse usuario ja existe")
    conn.execute(
        "INSERT INTO usuarios (usuario, nome, senha_hash, salt, perfil, ativo, criado_em) VALUES (?,?,?,?,?,1,?)",
        (nome_user, payload.nome.strip(), hash_senha(payload.senha, salt), salt, perfil, datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "usuario": nome_user}


@app.post("/api/usuarios/senha")
def trocar_senha(payload: TrocarSenhaPayload, u=Depends(exigir_admin)):
    nome_user = payload.usuario.strip().lower()
    if not payload.nova_senha:
        raise HTTPException(status_code=400, detail="Nova senha obrigatoria")
    salt = secrets.token_hex(16)
    conn = conectar()
    alvo = conn.execute("SELECT 1 FROM usuarios WHERE usuario = ?", (nome_user,)).fetchone()
    if not alvo:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    conn.execute(
        "UPDATE usuarios SET senha_hash = ?, salt = ? WHERE usuario = ?",
        (hash_senha(payload.nova_senha, salt), salt, nome_user),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/usuarios/{nome_user}")
def excluir_usuario(nome_user: str, u=Depends(exigir_admin)):
    nome_user = nome_user.strip().lower()
    if nome_user == u["usuario"]:
        raise HTTPException(status_code=400, detail="Voce nao pode excluir o proprio usuario logado")
    conn = conectar()
    conn.execute("DELETE FROM usuarios WHERE usuario = ?", (nome_user,))
    conn.execute("DELETE FROM sessoes WHERE usuario = ?", (nome_user,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ---------- Arquivos estaticos (o app em si) ----------
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
