
import asyncio
from playwright.async_api import async_playwright
import os
import json

async def handle_route(route, request):
    """
    Handles network requests for mocking, now with motorcycle data.
    """
    mock_catalog_data = {
        "data": {
            "cortes": [
                {"marca": "Honda", "categoria": "Motocicletas"},
                {"marca": "Yamaha", "categoria": "Motos"},
                {"marca": "Toyota", "categoria": "Sedan"}
            ],
            "sortedCategories": ["Motocicletas", "Motos", "Sedan"],
            "tutoriales": [], "relay": [], "logos": []
        }
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
        response_body = action_map[url][action]
        print(f"Mocking action '{action}' at '{url}'...")
        await route.fulfill(
            status=200,
            content_type="text/plain",
            body=json.dumps(response_body)
        )
    else:
        await route.continue_()

async def main():
    """
    Main function to run the Playwright script to verify the carousel fix.
    """
    session_data_str = os.environ.get("SESSION_DATA")
    if not session_data_str:
        print("Error: SESSION_DATA environment variable not set.")
        return
    try:
        session_data = json.loads(session_data_str)
    except json.JSONDecodeError as e:
        print(f"Error parsing SESSION_DATA JSON: {e}")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                storage_state={"origins": [{
                    "origin": "http://localhost:8000",
                    "localStorage": [{"name": "gpsepedia_session", "value": json.dumps(session_data)}]
                }]}
            )
        except Exception as e:
            print(f"Error creating browser context: {e}")
            await browser.close()
            return

        page = await context.new_page()
        await page.route("**/*", handle_route)

        try:
            await page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded", timeout=20000)

            # Wait for a specific element that indicates the carousels have been rendered
            await page.wait_for_selector("h4:text('Marcas de Motocicletas')", timeout=15000)
            print("Carousel title 'Marcas de Motocicletas' is visible.")

            screenshot_path = "carousel_fix_verification.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="carousel_fix_error.png", full_page=True)
            print("Error screenshot saved.")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
