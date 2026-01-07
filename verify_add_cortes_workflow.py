import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Use a pre-authenticated state to bypass login
        storage_state = {
            "origins": [
                {
                    "origin": "file://",
                    "localStorage": [
                        {
                            "name": "gpsepedia_session",
                            "value": """{
                                "Id_Usuario": "U-001",
                                "Nombre_Usuario": "Jules",
                                "Privilegios": "Desarrollador",
                                "SessionToken": "valid_token_for_jules"
                            }"""
                        }
                    ]
                }
            ]
        }
        # First, navigate to a blank page to establish a secure context
        page = await browser.new_page()
        await page.goto("about:blank")

        # Now, add the storage state to the context
        await page.context.add_cookies([]) # Dummy call to ensure context is usable
        await page.context.add_init_script("""
            localStorage.setItem('gpsepedia_session', JSON.stringify({
                "Id_Usuario": "U-001",
                "Nombre_Usuario": "Jules",
                "Privilegios": "Desarrollador",
                "SessionToken": "valid_token_for_jules"
            }));
        """)

        # Mock API responses for the entire workflow
        # Define the backend URL and inject it into the page
        SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwpIFH1nX2BZEjAKbpq9HJpEGNlo_0LqD1CwxWsWFo5J0AJDdbfMrKpcsAV4ZFJzFWd/exec"
        await page.context.add_init_script(f"const SCRIPT_URL = '{SCRIPT_URL}';")

        # Inject the api.js content
        with open('api.js', 'r') as f:
            api_manager_content = f.read()
        await page.context.add_init_script(api_manager_content)

        async def mock_api(route, request):
            if request.method != "POST" or not request.post_data_json:
                await route.continue_()
                return

            post_data = request.post_data_json
            action = post_data.get("action")

            if action == "getDropdownData":
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"status":"success","dropdowns":{"categoria":["Auto","Moto"],"tipoDeCorte":["Corte A","Corte B"],"tipoDeEncendido":["Llave","Botón"],"configRelay":["Config 1","Config 2"]}}'
                )
            elif action == "checkVehicle":
                 await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"status":"success","matches":[{"id":"V-001","marca":"Nissan","modelo":"Versa","anoDesde":"2020","tipoEncendido":"Llave"}]}'
                )
            elif action == "addOrUpdateCut":
                await route.fulfill(status=200, content_type="application/json", body='{"status":"success","vehicleId":"V-001"}')
            elif action == "addSupplementaryInfo":
                await route.fulfill(status=200, content_type="application/json", body='{"status":"success"}')
            else:
                await route.continue_()

        await page.context.route(SCRIPT_URL, mock_api)

        # Start a local server to avoid file:// protocol issues
        os.system("kill $(lsof -t -i:8000) 2>/dev/null || true")
        os.system("python3 -m http.server 8000 > server.log 2>&1 &")
        await asyncio.sleep(1) # Give server time to start

        await page.goto("http://localhost:8000/add_cortes.html")

        # Wait for the dropdowns to be populated before interacting with the form
        await page.wait_for_selector("#tipoEncendido option[value='Llave']")

        # --- Stage 1: Vehicle Verification ---
        await page.fill("#marca", "Nissan")
        await page.fill("#modelo", "Versa")
        await page.fill("#anoDesde", "2022")
        await page.select_option("#tipoEncendido", "Llave")
        await page.select_option("#categoria", "Auto")
        await page.click("button[type=submit]")

        await page.wait_for_selector("#stage-1-5.active")
        print("Stage 1.5 (Matches) is visible.")

        # --- Stage 2: Add New Cut ---
        await page.click("button:text('Agregar Nuevo Corte')")
        await page.wait_for_selector("#stage-2.active")
        print("Stage 2 (Add Cut) is visible.")

        await page.select_option("#tipoCorte1", "Corte A")
        await page.select_option("#configRelay1", "Config 1")
        await page.fill("#ubicacionCorte1", "Debajo del volante")
        await page.fill("#colorCableCorte1", "Rojo/Negro")
        await page.set_input_files("#imgCorte1", "test_image.jpg") # Assuming a dummy file
        await page.click("#form-stage-2 button[type=submit]")

        # --- Stage 3: Supplementary Info ---
        await page.wait_for_selector("#stage-3.active")
        print("Stage 3 (Supplementary Info) is visible.")

        await page.click(".accordion-header:has-text('Agregar Apertura')")
        await page.fill("#apertura", "Detalle de la apertura")
        await page.click("button:text('Guardar y Finalizar')")

        # Wait for a moment to ensure the final API call is made
        await asyncio.sleep(1)

        print("Workflow test completed successfully!")

        screenshot_path = "/home/jules/verification/add_cortes_workflow.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

# Create a dummy image file for the test
with open("test_image.jpg", "w") as f:
    f.write("dummy content")

asyncio.run(main())
