# DeFi Real Estate - Take-Home Assessment

Thank you for your interest in joining our team!  
This is a short take-home task to evaluate your skills with backend and smart contract code.

---

## Objective

Your goal is to review asmart contract small codebase, fix bugs, and improve testing for the backend API and smart contracts related to property transactions.

This task should take approximately **40 minutes**.

---

## What to Do

1. **Set Up**

   - Clone the provided code repository (or access the codebase files)
   - Setup the node version:
     ```bash
     nvm install 20
     nvm use 20
     ```
   - Install dependencies with:
     ```bash
     npm install --legacy-peer-deps
     ```
     `react-scripts` in this repo still declares an older TypeScript peer range, so `--legacy-peer-deps` avoids an unnecessary install failure.
   - Create a `.env` file in the repository root with the required backend runtime config:
     ```env
     JWT_SECRET=replace_this_with_a_long_random_secret_at_least_32_chars
     JWT_ISSUER=defi-property
     JWT_AUDIENCE=defi-property-api
     JWT_EXPIRES_IN=1h
     ```
     Notes:
     - `JWT_SECRET` is required and the backend will refuse to start if it is missing or shorter than 32 characters.
     - Do not commit `.env`.
   - Start a local MongoDB instance. The backend currently connects to:
     ```text
     mongodb://localhost/realestatedb
     ```
   - Run the project locally:
     ```bash
     npm start
     ```
   - The frontend will be available at `http://localhost:3000`
   - The backend will start on `http://localhost:5001`

2. **Run Tests**

   - Run the full unit test suite:
     ```bash
     npm test
     ```
   - Run only Solidity contract tests:
     ```bash
     npm run test:contracts
     ```
   - Run only the React test runner:
     ```bash
     npm run test:client
     ```

3. **Optional Provider Config**

   - The email route is wired for SendGrid, but this assessment does not require a live provider integration to run the app or unit tests.
   - If you want to exercise the email flow against a real provider, configure the relevant SendGrid environment separately before using that route.

4. **Review & Fix**

   - Check the backend code (Node.js) for bugs or issues
   - Review the smart contract code (Solidity) for bugs or missing features
   - Fix identified bugs
   - Add simple tests if missing (e.g., basic unit tests for smart contracts or API endpoints)

5. **Submit**

   - Push your changes via a pull request or share the updated code package
   - Briefly describe what you fixed or changed

---

## Focus Areas

- Backend API (Node.js)
- Smart contracts (Solidity)
- Basic tests (if any are missing or incomplete)

---

## Notes

- Keep your changes simple and clear
- Focus on high-impact bugs or issues
- You can use test networks or mock data as needed
- Remember, the goal is to demonstrate your problem-solving skills quickly
- The backend now fails closed on missing security-critical config instead of booting with insecure defaults
- The project includes Mocha-based backend and Solidity regression tests under `tests/`

---

## Good luck!  
We look forward to reviewing your submission.
