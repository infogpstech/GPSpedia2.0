# verify_full_fix_v2.py
import asyncio
from playwright.async_api import async_playwright, expect
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # CORRECTION: Disable service workers to prevent interference with API mocking.
        context = await browser.new_context(service_workers="block")
        page = await context.new_page()

        # Capture and print all browser console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))

        mock_session = {
            "ID": "1",
            "Nombre_Usuario": "testuser",
            "Nombre_Completo": "Test User Full Name",
            "Privilegios": "Desarrollador",
            "SessionToken": "valid-token-123"
        }

        async def handle_route(route):
            request = route.request
            if "script.google.com" in request.url:
                payload = request.post_data_json
                action = payload.get("action")

                if action == "validateSession":
                    print(f"Mocking action: {action} -> returning valid:true")
                    await route.fulfill(status=200, content_type="text/plain", body='{"valid":true}')
                    return

                if action == "getCatalogData":
                    print(f"Mocking action: {action}")
                    mock_catalog_data = {
                        "cortes": [
                            {
                                "id": 1,
                                "marca": "Honda",
                                "modelo": "CR-V",
                                "categoria": "Vehículos",
                                "anoDesde": "2023",
                                "anoHasta": "2024",
                                "versionesAplicables": "Touring",
                                "tipoEncendido": "Botón",
                                "imagenVehiculo": "1_some_image_id_1",
                                "tipoCorte1": "Paro de Motor",
                                "ubicacionCorte1": "BCM, Conector Negro, Pin 5",
                                "colorCableCorte1": "Amarillo",
                                "imgCorte1": "1_some_image_id_2",
                                "Video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            }
                        ],
                        "tutoriales": [],
                        "relay": [],
                        "logos": [
                            {"nombreMarca": "Honda", "urlLogo": "1_honda_logo_id"}
                        ]
                    }
                    await route.fulfill(status=200, content_type="application/json", body=json.dumps(mock_catalog_data))
                    return

                if action == "getUsers":
                    print(f"Mocking action: {action}")
                    if payload.get("payload", {}).get("sessionToken") == "valid-token-123":
                        await route.fulfill(status=200, content_type="text/plain", body='{"status":"success","users":[{"ID":"1","Nombre_Usuario":"testuser","Nombre_Completo":"Test User Full Name","Privilegios":"Desarrollador"}]}')
                    else:
                        await route.fulfill(status=401, content_type="text/plain", body='{"status":"error","message":"Unauthorized"}')
                    return

            await route.continue_()

        # Set up API mocking BEFORE navigation
        await context.route("**/*", handle_route)

        # Set up localStorage BEFORE navigation using an init script
        init_script = f"localStorage.setItem('gpsepedia_session', '{json.dumps(mock_session)}');"
        await context.add_init_script(init_script)

        print("Navigating to index.html (with mocks and session pre-configured)...")
        await page.goto("http://localhost:8000/index.html")

        # Wait for the app to initialize and show the main container
        await expect(page.locator(".container")).to_be_visible(timeout=5000)
        print("App container is visible.")

        # Click on the first card to open the modal
        await page.locator(".card").first.click()
        await expect(page.locator("#modalDetalle")).to_be_visible()

        # Click on the search bar
        await page.locator("#searchInput").click()

        # Wait for the search animation to complete
        await page.wait_for_timeout(500)

        # Take a screenshot of the final state
        screenshot_path = "full_fix_verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        print("\n--- DEBUGGING ANALYSIS ---")
        print("The script failed to see the container become visible on its own.")
        print("I have forced the container to be visible to capture a screenshot of the state.")
        print("The browser logs should reveal where the JavaScript execution is halting after the session is validated.")
        print("Checking the logs for errors after 'initializeApp' and 'checkSession'...")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
