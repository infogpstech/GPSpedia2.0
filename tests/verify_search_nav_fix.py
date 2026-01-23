import asyncio
from playwright.async_api import async_playwright, expect
import subprocess
import time

async def main():
    server_process = None
    try:
        # 1. Iniciar el servidor web local y capturar su salida
        print("Iniciando servidor local...")
        server_process = subprocess.Popen(
            ['python3', 'server.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        time.sleep(2)  # Dar tiempo al servidor para que inicie

        # Comprobar si el servidor falló al iniciar
        if server_process.poll() is not None:
            stdout, stderr = server_process.communicate()
            print("Error al iniciar el servidor.")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return
        print("Servidor iniciado correctamente.")

        # 2. Iniciar Playwright y ejecutar la lógica de la prueba dentro de su contexto
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()

            # Inyectar datos de sesión falsos para evitar el login
            await context.add_init_script("""
                localStorage.setItem('sessionToken', 'dummy_token');
                localStorage.setItem('userId', 'dummy_user');
                localStorage.setItem('currentUser', JSON.stringify({
                    "ID": "dummy_user",
                    "Nombre_Usuario": "TestUser",
                    "Privilegios": "Desarrollador"
                }));
            """)

            page = await context.new_page()

            try:
                # Ir a la página y esperar a que los módulos estén listos
                await page.goto("http://localhost:8000/")
                await page.wait_for_load_state('domcontentloaded')
                await page.wait_for_function('() => window.state && window.ui')

                # Mock de la respuesta de la API con un JSON de catálogo válido
                with open('mock_catalog_data.json', 'r') as f:
                    mock_data = f.read()
                await page.route("**/macros/s/**", lambda route: route.fulfill(
                    status=200,
                    content_type="text/plain;charset=UTF-8",
                    # La API real envuelve el JSON en un objeto 'data'
                    body='{"status":"success","data":' + mock_data + '}'
                ))

                # Forzar la carga de datos y la visualización de la app
                await page.evaluate("window.state.loadCatalogData()")
                await page.wait_for_timeout(1000)
                await page.evaluate("window.ui.showApp({})")

                # --- INICIO DE LA LÓGICA DE PRUEBA ---
                search_term = "CR-V"
                print(f"--- Iniciando prueba: Búsqueda de '{search_term}' ---")

                # 1. Realizar la búsqueda
                await page.fill("#searchInput", search_term)
                await page.press("#searchInput", "Enter")
                await page.wait_for_timeout(1000)

                # 2. Verificar que se muestre la tarjeta de la versión "Touring"
                print("Verificando que se muestre la tarjeta de versión/equipamiento...")
                touring_card = page.locator('.card .overlay', has_text="Touring")
                await expect(touring_card).to_be_visible()
                print("OK: Se encontró la tarjeta para la versión 'Touring'.")

                # 3. Hacer clic en la tarjeta
                print("Haciendo clic en la tarjeta 'Touring'...")
                await touring_card.click()
                await page.wait_for_timeout(1000)

                # 4. Verificar que la página navegó a la selección de AÑO
                print("Verificando que se muestre la pantalla de selección de año...")
                await expect(page.locator("h4", has_text="Años de CR-V")).to_be_visible()
                print("OK: El título de la página es 'Años de CR-V'.")

                year_card = page.locator('.card .overlay', has_text="2016 - 2022")
                await expect(year_card).to_be_visible()
                print("OK: Se encontró la tarjeta para el rango de años '2016 - 2022'.")

                print("\n--- PRUEBA COMPLETADA CON ÉXITO ---")

            except Exception as e:
                print(f"\n--- ERROR DURANTE LA PRUEBA ---")
                print(f"{e}")
                await page.screenshot(path='error_screenshot.png')
                print("Se ha guardado una captura de pantalla del error en 'error_screenshot.png'")

    finally:
        # 3. Detener el servidor de forma segura
        if server_process:
            print("Deteniendo el servidor...")
            server_process.terminate()
            try:
                stdout, stderr = server_process.communicate(timeout=5)
                # print(f"Salida del servidor (stdout):\n{stdout}") # Opcional: Descomentar para depurar
                # print(f"Salida del servidor (stderr):\n{stderr}") # Opcional: Descomentar para depurar
            except subprocess.TimeoutExpired:
                print("El servidor no terminó a tiempo, forzando la detención.")
                server_process.kill()

if __name__ == '__main__':
    asyncio.run(main())
