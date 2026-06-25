"""
Servidor MCP local para el laboratorio qaLabMcp
Expone herramientas de validacion, generacion de casos de prueba y calculos.
"""

import json
import os
import re
from typing import Any, Dict, List

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("qaLabMcp")


@mcp.tool()
def validar_cliente(cip: str, telefono: str, email: str) -> Dict[str, Any]:
    """
    Valida y normaliza datos de un cliente.
    """
    errores = []
    datos_normalizados = {}

    cip_limpio = cip.strip()
    if cip_limpio.isdigit() and 4 <= len(cip_limpio) <= 10:
        datos_normalizados["cip"] = cip_limpio
    else:
        errores.append(f"CIP invalido: debe ser numerico de 4-10 digitos ({cip})")

    telefono_limpio = re.sub(r"[\s\-]", "", telefono.strip())
    telefono_limpio = re.sub(r"^0", "", telefono_limpio)

    if re.match(r"^9\d{8}$", telefono_limpio):
        datos_normalizados["telefono"] = telefono_limpio
        datos_normalizados["telefono_formato"] = (
            f"{telefono_limpio[:3]}-{telefono_limpio[3:6]}-{telefono_limpio[6:]}"
        )
    else:
        errores.append(f"Telefono invalido: formato esperado 9XXXXXXXX ({telefono})")

    email_limpio = email.strip().lower()
    if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email_limpio):
        datos_normalizados["email"] = email_limpio
    else:
        errores.append(f"Email invalido: {email}")

    return {
        "valido": len(errores) == 0,
        "datos_normalizados": datos_normalizados,
        "errores": errores,
    }


@mcp.tool()
def generar_caso_prueba(endpoint: str, metodo: str, escenario: str) -> Dict[str, Any]:
    """
    Genera un caso de prueba funcional basado en endpoint, metodo y escenario.
    """
    escenarios = {
        "credenciales invalidas": {
            "precondiciones": "Usuario registrado en el sistema",
            "datos_entrada": {"username": "usuario_errado", "password": "clave_incorrecta"},
            "pasos": [
                "1. Navegar a la pagina de login",
                "2. Ingresar credenciales invalidas",
                "3. Hacer clic en boton Ingresar",
            ],
            "resultado_esperado": 'Mensaje de error "Credenciales incorrectas"',
        },
        "credenciales validas": {
            "precondiciones": "Usuario registrado con credenciales correctas",
            "datos_entrada": {"username": "usuario_valido@test.com", "password": "Password123!"},
            "pasos": [
                "1. Navegar a la pagina de login",
                "2. Ingresar credenciales validas",
                "3. Hacer clic en boton Ingresar",
            ],
            "resultado_esperado": "Redireccion a dashboard, sesion iniciada",
        },
        "campos vacios": {
            "precondiciones": "Ninguna",
            "datos_entrada": {"username": "", "password": ""},
            "pasos": [
                "1. Navegar a la pagina de login",
                "2. Dejar campos vacios",
                "3. Hacer clic en boton Ingresar",
            ],
            "resultado_esperado": "Validacion de campos requeridos",
        },
        "sql injection": {
            "precondiciones": "Ninguna",
            "datos_entrada": {"username": "' OR '1'='1", "password": "' OR '1'='1"},
            "pasos": [
                "1. Navegar a la pagina de login",
                "2. Ingresar payload SQL injection",
                "3. Hacer clic en boton Ingresar",
            ],
            "resultado_esperado": "No se permite acceso, mensaje de error generico",
        },
        "token expirado": {
            "precondiciones": "Usuario con sesion activa pero token vencido",
            "datos_entrada": {"Authorization": "Bearer token_expirado"},
            "pasos": [
                "1. Realizar request con token expirado",
                "2. Enviar peticion GET/POST al endpoint",
            ],
            "resultado_esperado": "Codigo 401 Unauthorized",
        },
    }

    escenario_lower = escenario.lower()
    datos_escenario = None

    for key, value in escenarios.items():
        if key in escenario_lower or escenario_lower in key:
            datos_escenario = value
            break

    if not datos_escenario:
        datos_escenario = {
            "precondiciones": "Segun documentacion del sistema",
            "datos_entrada": {"request": "Datos segun especificacion"},
            "pasos": [
                f"1. Preparar datos para {escenario}",
                f"2. Enviar solicitud {metodo} a {endpoint}",
                "3. Validar respuesta",
            ],
            "resultado_esperado": "Respuesta segun contrato del API",
        }

    return {
        "id_caso": f"CP-{metodo.upper()}-{endpoint.replace('/', '_').replace('-', '_')}",
        "nombre": f"CP: {escenario} - {metodo} {endpoint}",
        "endpoint": endpoint,
        "metodo": metodo.upper(),
        "escenario": escenario,
        **datos_escenario,
        "resultado_esperado_codigo": (
            400 if "invalidas" in escenario_lower or "vacio" in escenario_lower else 200
        ),
    }


@mcp.tool()
def calcular_percentil_simple(valores: List[float], percentil: float) -> Dict[str, Any]:
    """
    Calcula el percentil especificado de una lista de valores.
    """
    if not valores:
        return {"error": "Lista vacia", "percentil": None, "valores_ordenados": []}

    if not (0 <= percentil <= 100):
        return {"error": "Percentil debe estar entre 0 y 100", "percentil": None, "valores": valores}

    valores_ordenados = sorted(valores)
    n = len(valores_ordenados)
    k = (n - 1) * (percentil / 100)
    f = int(k)
    c = f + 1 if f < n - 1 else f

    if f == c:
        resultado = valores_ordenados[f]
    else:
        d0 = valores_ordenados[f] * (c - k)
        d1 = valores_ordenados[c] * (k - f)
        resultado = d0 + d1

    media = sum(valores) / n
    min_val = min(valores)
    max_val = max(valores)

    return {
        "percentil": percentil,
        "resultado": round(resultado, 2),
        "valores_ordenados": valores_ordenados,
        "total_datos": n,
        "media": round(media, 2),
        "min": min_val,
        "max": max_val,
        "rango": max_val - min_val,
    }


@mcp.tool()
def clasificar_error_http(status_code: int) -> Dict[str, Any]:
    """
    Clasifica un codigo de estado HTTP en su categoria.
    """
    if 100 <= status_code < 200:
        clasificacion = "Informacional"
        descripcion = "La solicitud fue recibida y continua el proceso"
    elif 200 <= status_code < 300:
        clasificacion = "Exito"
        descripcion = "La solicitud fue exitosa"
    elif 300 <= status_code < 400:
        clasificacion = "Redireccion"
        descripcion = "Se requiere accion adicional para completar la solicitud"
    elif 400 <= status_code < 500:
        clasificacion = "Error del cliente"
        descripcion = "La solicitud tiene sintaxis incorrecta o no puede completarse"
    elif 500 <= status_code < 600:
        clasificacion = "Error del servidor"
        descripcion = "El servidor fallo al completar una solicitud valida"
    else:
        clasificacion = "Desconocido"
        descripcion = "Codigo de estado no valido"

    return {
        "status_code": status_code,
        "clasificacion": clasificacion,
        "descripcion": descripcion,
    }


@mcp.tool()
def evaluar_sla(p95_ms: float, limite_ms: float) -> Dict[str, Any]:
    """
    Evalua si el percentil 95 de latencia cumple con el SLA.
    """
    diferencia = limite_ms - p95_ms
    cumple = p95_ms <= limite_ms

    return {
        "p95_ms": p95_ms,
        "limite_ms": limite_ms,
        "cumple": cumple,
        "diferencia_ms": round(diferencia, 2),
        "mensaje": f"{'CUMPLE' if cumple else 'NO CUMPLE'} SLA (margen: {abs(round(diferencia, 2))} ms)",
    }


@mcp.tool()
def validar_respuesta_api(
    status_code: int,
    tiempo_ms: float,
    limite_ms: float,
    tiene_token: bool,
) -> Dict[str, Any]:
    """
    Valida una respuesta de API segun multiples criterios.
    """
    validaciones = []
    valido = True

    es_2xx = 200 <= status_code < 300
    validaciones.append({
        "criterio": "Codigo de estado 2xx",
        "valor": status_code,
        "cumple": es_2xx,
    })
    if not es_2xx:
        valido = False

    tiempo_ok = tiempo_ms <= limite_ms
    validaciones.append({
        "criterio": f"Tiempo <= {limite_ms}ms",
        "valor": f"{tiempo_ms}ms",
        "cumple": tiempo_ok,
    })
    if not tiempo_ok:
        valido = False

    validaciones.append({
        "criterio": "Token de autenticacion presente",
        "valor": tiene_token,
        "cumple": tiene_token,
    })
    if not tiene_token:
        valido = False

    return {
        "valido": valido,
        "status_code": status_code,
        "tiempo_ms": tiempo_ms,
        "limite_ms": limite_ms,
        "tiene_token": tiene_token,
        "validaciones": validaciones,
        "mensaje": "Valido: cumple todos los criterios"
        if valido
        else "Invalido: no cumple todos los criterios",
    }


@mcp.tool()
def buscar_cliente(cip: str) -> Dict[str, Any]:
    """
    Busca un cliente en el archivo datos_prueba.json por CIP.
    """
    ruta_base = os.path.dirname(os.path.abspath(__file__))
    ruta_json = os.path.join(ruta_base, "datos_prueba.json")

    try:
        with open(ruta_json, "r", encoding="utf-8") as archivo:
            datos = json.load(archivo)

        clientes = datos.get("clientes", [])
        for cliente in clientes:
            if cliente.get("cip") == cip:
                return {
                    "encontrado": True,
                    "cliente": cliente,
                }

        return {
            "encontrado": False,
            "mensaje": f"No se encontro cliente con CIP: {cip}",
            "cip_buscado": cip,
            "cips_disponibles": [c.get("cip") for c in clientes],
        }

    except FileNotFoundError:
        return {
            "encontrado": False,
            "error": f"Archivo datos_prueba.json no encontrado en {ruta_json}",
        }
    except json.JSONDecodeError as e:
        return {
            "encontrado": False,
            "error": f"Error al parsear JSON: {str(e)}",
        }


if __name__ == "__main__":
    mcp.run()
