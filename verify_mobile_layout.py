
import asyncio
import json
from playwright.async_api import async_playwright, expect

# --- Mocks and Constants ---
AUTH_SERVICE_URL = "https://script.google.com/macros/s/AKfycbwATstMSSnuYZMeGEjI7Q5cznO6kA8rqLo7zNZLmu_f29qwcyt4Fucn5VIBdB9tMoRg/exec"
CATALOG_SERVICE_URL = "https://script.google.com/macros/s/AKfycbxenVjZe9C8-0RiYKLxpGfQtobRzydBke44IM4NdNNjh5VRdlB91Ce9dWvQ2xnDFXk0/exec"

MOCK_SESSION = {
    "ID": "1", "Nombre_Usuario": "testuser", "Privilegios": "Desarrollador",
    "SessionToken": "valid-token-123", "Nombre_Completo": "Test User Full"
}

MOCK_CATALOG_DATA = {
    "status": "success",
    "cortes": [{"id": 1, "categoria": "SUV", "marca": "Toyota", "modelo": "RAV4", "imagenVehiculo": "1-valid-id"}],
    "logos": [], "tutoriales": [], "relay": []
}

async def handle_route(route):
    request = route.request
    url = request.url
    payload = request.post_data_json if request.post_data else {}
    action = payload.get("action")

    if AUTH_SERVICE_URL in url and action == "validateSession":
        await route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": "success", "valid": True}))
        return

    if CATALOG_SERVICE_URL in url and action == "getCatalogData":
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_CATALOG_DATA))
        return

    await route.continue_()

async def main():
    async with async_playwright() as p:
        iphone_12 = p.devices['iPhone 12']
        browser = await p.webkit.launch(headless=True)
        context = await browser.new_context(**iphone_12, service_workers="block")

        await context.route("**/*", handle_route)
        await context.add_init_script(f"localStorage.setItem('gpsepedia_session', '{json.dumps(MOCK_SESSION)}');")

        page = await context.new_page()

        try:
            print("Navigating to index.html...")
            await page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded")

            await expect(page.locator(".card").first).to_be_visible(timeout=10000)
            print("✅ Application loaded and content is visible.")

            search_input = page.locator('#searchInput')
            await search_input.focus()
            print("✅ Focused on search input.")

            await page.wait_for_timeout(1000) # Wait for keyboard and animation

            screenshot_path = 'mobile_layout_fix_verification.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"📸 Screenshot saved to {screenshot_path}")
            print("📝 Please inspect the screenshot to confirm the fix.")

        except Exception as e:
            print(f"❌ TEST FAILED: {e}")
            await page.screenshot(path="mobile_layout_fix_error.png")
            raise
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
