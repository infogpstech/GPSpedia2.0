import asyncio
from playwright.async_api import async_playwright
import subprocess
import time

async def main():
    server_process = None
    try:
        print("Iniciando servidor local...")
        server_process = subprocess.Popen(['python3', 'server.py'])
        time.sleep(2)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            print("Navegando a la página...")
            await page.goto("http://localhost:8000/")

            print("Esperando a que la aplicación se inicialice (window.state y window.ui)...")
            await page.wait_for_function('() => window.state && window.ui', timeout=15000)

            print("\n--- PRUEBA COMPLETADA CON ÉXITO ---")
            print("La aplicación se ha cargado correctamente y los módulos JS están definidos.")

    except Exception as e:
        print(f"\n--- ERROR DURANTE LA PRUEBA ---")
        print(f"{e}")
        await page.screenshot(path='load_error_screenshot.png')
        print("Se ha guardado una captura de pantalla del error en 'load_error_screenshot.png'")

    finally:
        if server_process:
            print("Deteniendo el servidor...")
            server_process.terminate()

if __name__ == '__main__':
    asyncio.run(main())
