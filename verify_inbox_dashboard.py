import asyncio
from playwright.async_api import async_playwright
import json
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(service_workers="block")

        # Mock session
        session_data = {
            "ID": "1",
            "Nombre_Usuario": "TestUser",
            "Privilegios": "Desarrollador",
            "SessionToken": "test-token"
        }

        # Inject session via init script
        await context.add_init_script(f"localStorage.setItem('gpsepedia_session', '{json.dumps(session_data)}');")

        page = await context.new_page()

        # Mock API calls
        async def handle_route(route):
            post_data = route.request.post_data_json
            action = post_data.get('action')

            if action == 'validateSession':
                await route.fulfill(status=200, body=json.dumps({"valid": True}), content_type="application/json")
            elif action == 'getCatalogData':
                await route.fulfill(status=200, body=json.dumps({
                    "status": "success",
                    "cortes": [{"id": 1, "marca": "Test", "modelo": "Test", "categoria": "Test", "anoDesde": 2020}],
                    "logos": [], "relay": [], "tutoriales": []
                }), content_type="application/json")
            elif action == 'getFeedbackItems':
                await route.fulfill(status=200, body=json.dumps({
                    "status": "success",
                    "data": [{"id": "FB1", "subject": "Test Feedback", "content": "Test Content", "user": "User1", "type": "problem_report"}]
                }), content_type="application/json")
            elif action == 'getActivityLogs':
                await route.fulfill(status=200, body=json.dumps({
                    "status": "success",
                    "data": [{"timestamp": "2026-02-02T10:00:00Z", "nombreUsuario": "Admin", "tipoActividad": "Login", "detalle": "Success"}]
                }), content_type="application/json")
            else:
                await route.continue_()

        await page.route("**/exec**", handle_route)

        try:
            await page.goto("http://localhost:8000/index.html")

            # Wait for app to load
            await page.wait_for_selector(".container:not([style*='display: none'])", timeout=5000)
            print("App loaded successfully")

            # Open Side Menu
            await page.click("#hamburger-btn")
            await page.wait_for_selector("#side-menu.open")

            # Check Inbox
            print("Testing Inbox...")
            await page.click("#inbox-btn")
            await page.wait_for_selector("#inbox-modal[style*='display: flex']", timeout=3000)

            # Wait for content
            await page.wait_for_selector("#inbox-list .inbox-item", timeout=5000)
            inbox_content = await page.inner_text("#inbox-list")
            if "Test Feedback" in inbox_content:
                print("Inbox loaded data successfully")
            else:
                print("Inbox failed to load data")

            # Close Inbox
            await page.click("#inbox-modal .info-close-btn")

            # Open Side Menu again for Dashboard
            await page.click("#hamburger-btn")

            # Check Dashboard
            print("Testing Dashboard...")
            await page.click("#dashboard-btn")
            await page.wait_for_selector("#dashboard-modal[style*='display: flex']", timeout=3000)

            # Wait for content
            await page.wait_for_selector("#activity-logs tr td", timeout=5000)
            dashboard_content = await page.inner_text("#activity-logs")
            if "Login" in dashboard_content:
                print("Dashboard loaded data successfully")
            else:
                print("Dashboard failed to load data")

            await page.screenshot(path="verification_result.png")
            print("Screenshot saved as verification_result.png")

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path="verification_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
