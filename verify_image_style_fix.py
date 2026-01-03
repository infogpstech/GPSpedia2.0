
import asyncio
from playwright.async_api import async_playwright, expect
import os
import json

async def handle_route(route, request):
    """
    Handles network requests for mocking, providing data to populate the modal.
    """
    mock_item = {
        "id": "1", "marca": "Toyota", "modelo": "Corolla", "anoDesde": "2022",
        "imagenVehiculo": "https://drive.google.com/thumbnail?id=1example_vehicle_id",
        "tipoCorte1": "Corte de Ejemplo",
        "imgCorte1": "https://drive.google.com/thumbnail?id=1example_cut_id"
    }

    mock_catalog_data = {
        "data": { "cortes": [mock_item], "sortedCategories": ["Sedan"], "tutoriales": [], "relay": [], "logos": [] }
    }

    action_map = {
        "https://script.google.com/macros/s/AKfycby86oaNWKj9Z3sXWs-tXJn2eIgU9QcpjaC6cyYReswtc_WSypt3fFtQ-3aAs58ZMa72/exec": {
            "validateSession": {"valid": True},
        },
        "https://script.google.com/macros/s/AKfycbzUdYI2MpBcXvXsNZvfBTbsDmBBzFgsqONemSd6vjwGEP2jls_eIVjXylU-nXgWa7-m7A/exec": {
            "getCatalogData": mock_catalog_data,
        }
    }

    url = request.url
    post_data = request.post_data_json if request.method == "POST" and request.post_data else {}
    action = post_data.get("action")

    if url in action_map and action in action_map[url]:
        await route.fulfill(status=200, content_type="text/plain", body=json.dumps(action_map[url][action]))
    else:
        await route.continue_()

async def main():
    session_data_str = os.environ.get("SESSION_DATA")
    if not session_data_str:
        print("Error: SESSION_DATA environment variable not set.")
        return
    session_data = json.loads(session_data_str)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            storage_state={"origins": [{"origin": "http://localhost:8000", "localStorage": [{"name": "gpsepedia_session", "value": json.dumps(session_data)}]}]}
        )
        page = await context.new_page()
        await page.route("**/*", handle_route)

        try:
            await page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded")

            # Click the card to open the modal
            await page.wait_for_selector(".card", timeout=10000)
            await page.click(".card")

            # Wait for the modal to be visible
            modal_selector = "#detalleCompleto"
            await page.wait_for_selector(modal_selector, state="visible", timeout=10000)
            print("Modal is visible.")

            # --- 1. VISUAL VERIFICATION ---
            await page.locator(modal_selector).screenshot(path="image_style_verification.png")
            print("Screenshot of the modal saved to image_style_verification.png")

            # --- 2. STYLE VERIFICATION ---
            vehicle_image = page.locator(".img-vehiculo-modal")
            cut_image = page.locator('img[alt="Imagen del Corte"]')

            await expect(vehicle_image).to_have_css("filter", "drop-shadow(rgba(0, 0, 0, 0.4) 2px 4px 6px)")
            await expect(vehicle_image).to_have_css("background-color", "rgba(0, 0, 0, 0)") # transparent

            # Assert that the other image does NOT have these styles
            cut_image_filter = await cut_image.evaluate("element => window.getComputedStyle(element).filter")
            if cut_image_filter == "none":
                 print("Style isolation successful: Cut image has no filter.")
            else:
                 raise Exception(f"Style isolation failed: Cut image has unexpected filter: {cut_image_filter}")

            print("Style verification successful!")

        except Exception as e:
            print(f"An error occurred during verification: {e}")
            await page.screenshot(path="image_style_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
