
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Listen for page errors
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        async def mock_route(route):
            request = route.request
            try:
                post_data = request.post_data_json
                if "script.google.com" in request.url and post_data:
                    action = post_data.get("action")
                    print(f"Intercepted API action: {action}")
                    if action == "validateSession":
                        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"valid": True}))
                    elif action == "getCatalogData":
                        await route.fulfill(
                            status=200,
                            content_type="application/json",
                            body=json.dumps({
                                "data": {
                                    "cortes": [{
                                        "id": 1, "categoria": "Automóvil", "marca": "Toyota", "modelo": "Corolla",
                                        "anoDesde": "2020", "anoHasta": "2023", "tipoEncendido": "Llave",
                                        "imagenVehiculo": "https://drive.google.com/thumbnail?id=1-9f9w9dof9w9d",
                                        "timestamp": "2024-07-29T10:00:00Z", "tipoCorte1": "Ignición", "utilCorte1": 10
                                    }],
                                    "tutoriales": [], "relay": [],
                                    "logos": [{"nombreMarca": "Toyota", "urlLogo": "https://drive.google.com/thumbnail?id=1-9f9w9dof9w9d"}],
                                    "sortedCategories": ["Automóvil", "Motocicletas"]
                                }
                            })
                        )
                    else:
                        await route.continue_()
                else:
                    await route.continue_()
            except Exception as e:
                print(f"Error in mock_route: {e}")
                await route.continue_()

        await page.route("**/*", mock_route)

        await page.goto("http://localhost:8000")

        session_data = {"ID": "1", "Nombre_Usuario": "Test User", "Privilegios": "Desarrollador", "SessionToken": "test-token"}
        await page.evaluate(
            "(session) => { localStorage.setItem('gpsepedia_session', session); }",
            json.dumps(session_data)
        )

        await page.reload()

        # Forcefully hide splash screen and show main content as a workaround
        await page.evaluate("document.getElementById('splash-screen').style.display = 'none';")
        await page.evaluate("document.getElementById('main-content-container').style.display = 'block';")

        await page.wait_for_selector("#main-content-container", state="visible")

        # Add a small delay to ensure rendering is complete after workaround
        await page.wait_for_timeout(500)

        await page.click("text=Toyota") # A more specific selector
        await page.wait_for_selector("#modalDetalle.visible")

        await page.screenshot(path="screenshot.png")
        await browser.close()

asyncio.run(main())
