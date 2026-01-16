import asyncio
from playwright.async_api import async_playwright
import json

async def handle_route(route):
    request = route.request
    if request.method == "POST":
        try:
            post_data = json.loads(request.post_data)
            action = post_data.get("action")
            if action == "validateSession":
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": "success", "valid": True}))
            elif action == "getCatalogData":
                mock_catalog = {
                    "status": "success",
                    "data": {
                        "cortes": [
                            {
                                "id": i, "categoria": "Autos", "marca": "Toyota", "modelo": "Corolla",
                                "anoDesde": "2020", "anoHasta": "2023", "tipoEncendido": "Llave",
                                "imagenVehiculo": "1NxBx-W_gWmcq3fA9zog6Dpe-WXpH_2e8"
                            } for i in range(1, 15)
                        ],
                        "tutoriales": [], "relay": [], "logos": [], "sortedCategories": ["Autos"]
                    }
                }
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps(mock_catalog))
        except: pass
    await route.continue_()

async def run():
    async with async_playwright() as p:
        iphone_13 = p.devices['iPhone 13']
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(**iphone_13, service_workers="block")
        page = await context.new_page()

        await page.route("**/macros/s/**/exec", handle_route)
        await context.add_init_script("window.localStorage.setItem('gpsepedia_session', JSON.stringify({ID: '1', Nombre_Usuario: 'TestUser', SessionToken: 'test-token', Privilegios: 'Desarrollador'}));")

        await page.goto("http://localhost:8000")
        await page.wait_for_selector(".container", state="visible")

        # Verify Hamburger Button
        hamburger = page.locator("#hamburger-btn")
        is_visible = await hamburger.is_visible()
        print(f"Hamburger visible: {is_visible}")

        # Capture Initial
        await page.screenshot(path="tests/screenshots/restore_initial.png")

        # Search focus
        search_input = page.locator("#searchInput")
        await search_input.focus()
        # Wait for some animation frames
        await page.wait_for_timeout(200)
        await page.screenshot(path="tests/screenshots/restore_animating.png")

        await page.wait_for_timeout(400) # Finish animation
        await page.screenshot(path="tests/screenshots/restore_final.png")

        # Verify Hamburger hidden in search
        is_visible_search = await hamburger.is_visible()
        print(f"Hamburger visible in search: {is_visible_search}")

        # Check title opacity (should be near 0)
        opacity = await page.evaluate("getComputedStyle(document.querySelector('.header-top')).opacity")
        print(f"Header-top opacity in search: {opacity}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
