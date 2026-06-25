# qaLabMcp

Servidor MCP local para probar herramientas desde VS Code y GitHub Copilot Chat/Agent.

## Estructura

```text
qaLabMcp/
├── .vscode/
│   └── mcp.json
├── evidencia/
├── datos_prueba.json
├── README_USO.md
└── server.py
```

## Instalar dependencia

```powershell
pip install "mcp[cli]"
```

## Verificar compilacion

Desde la carpeta `qaLabMcp`:

```powershell
python -m py_compile server.py
python -c "import mcp; print('mcp disponible')"
```

## Iniciar servidor MCP en VS Code

1. Abre VS Code directamente en la carpeta `qaLabMcp`.
2. Presiona `Ctrl+Shift+P`.
3. Ejecuta `MCP: List Servers`.
4. Selecciona `qaLabMcp`.
5. Selecciona `Start Server`.
6. En Output debe aparecer `Connection state: Running` y `Discovered 7 tools`.

## Prompt de prueba

En Copilot Chat/Agent:

```text
Usa la herramienta buscar_cliente para encontrar el cliente con CIP "12345" en el archivo datos_prueba.json.
```

## Evidencia

Guarda capturas en `evidencia/` mostrando:

1. La herramienta visible o invocada.
2. El prompt utilizado.
3. El resultado devuelto.
