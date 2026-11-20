# Amazing Coffee Inventory Planning Prototype

This prototype is designed for the SCM6111 project on supply chain modelling and analytics. It helps the manager forecast next-week demand and evaluate the ingredient ordering plan for three products: Cappuccino, Latte, and Mocha.

## 1. Project background

Amazing Coffee operates a shop in Hong Kong and sells three popular beverages:

- Cappuccino
- Latte
- Mocha

The company needs to forecast demand for the coming week and decide when to order raw materials to avoid stock-out while controlling inventory holding cost.

The main ingredients include:

- Coffee Bean
- Milk Foam
- Steamed Milk
- Chocolate Powder

The business also has a supplier discount every Thursday, so the ordering plan should consider whether to place orders on discount days and how inventory cost will change.

## 2. Forecasting logic

The prototype uses historical data from the previous 15 days and identifies weekday patterns. It is designed to reflect the following assumptions:

- Sales demand is seasonal by day of week.
- Thursday promotion increases beverage demand significantly.
- Each beverage product has its own demand curve.
- Future demand can be adjusted manually by the manager in the interface.

## 3. Interface overview

The webpage includes the following sections:

### Overview

This section explains the forecasting and planning objective and summarizes key indicators such as:

- estimated weekly sales volume
- expected material usage
- discount timing

### Forecast result

This section presents the expected next-week demand by product. The chart shows all three beverage categories together, and moving the cursor over the chart reveals the daily demand values for each product.

### Manager planning controls

The manager can adjust daily demand assumptions for each product manually. After any input change, the forecast and order results update immediately, and the plan recalculates based on the current weekly demand assumptions.

### Run Forecast

The top-right button labeled Run Forecast triggers a refresh of the current weekly planning logic. It is used to apply the latest demand assumptions entered in the Manager planning controls and recalculate the projected order plan, inventory balances, and cost summary. In other words, this button acts as the execution trigger for the dashboard model after the manager has updated the demand inputs or changed scenario assumptions.

### Key functions

The prototype includes a compact set of decision-support functions positioned directly beneath the top title area:

- forecasting based on historical weekday patterns
- converting beverage demand into ingredient requirements
- evaluating order timing and discount opportunities
- testing demand and cost sensitivity scenarios

### Result and sensitivity

This section displays the projected order plan and cost breakdown, including:

- ingredient order cost
- inventory holding cost
- weekly total cost
- order schedule by ingredient and order day
- inventory balance details for the selected day

Managers can also vary key parameters including:

- supplier discount rate
- holding cost multiplier
- demand change percentage

The system updates total cost, purchase timing, and recommendation logic based on the same underlying cost model used in the main dashboard.

## 4. Data assumptions and decision logic

The current prototype uses the following assumptions based on the project brief and final implementation:

- Demand is forecasted using day-of-week trends and historical sales patterns.
- Ingredient recipes are fixed for each beverage.
- Weekly replenishment starts without any existing inventory before Monday.
- Monday, Thursday, and Saturday are the candidate order windows.
- The LP decides whether to place an order and determines the purchase quantity in each candidate window.
- Thursday applies a supplier discount, which may change the LP solution and the projected order quantities.
- Inventory holding cost is included in the weekly cost calculation.
- The weekly total cost is defined as ingredient order cost + holding cost.
- The inventory balance table shows opening inventory, consumed quantity, ending inventory, and holding cost for the selected day.

## 5. How to run the prototype

Open the project folder and launch either version.

### Static HTML dashboard

- Open [index.html](index.html)
- No additional server is required

### Streamlit LP dashboard

Run locally:

```bash
.venv/bin/streamlit run streamlit_app.py
```

Then open the local URL shown by Streamlit. The Streamlit version uses SciPy HiGHS to solve a linear programming model that minimizes ingredient purchasing cost plus inventory holding cost. Monday, Thursday, and Saturday are candidate order windows; the LP determines whether an order is placed and the exact quantity for each candidate window.

### Deploy to Streamlit Community Cloud

1. Upload this project to a GitHub repository.
2. Open Streamlit Community Cloud and create a new app.
3. Set the main file to `streamlit_app.py`.
4. Keep [requirements.txt](requirements.txt) in the project root.
5. Deploy the app and share the generated public URL.

See [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md) for the complete deployment checklist.

## 6. File structure

- [index.html](index.html): main dashboard structure with overview, planning controls, key functions, projected order plan, inventory balances, and sensitivity testing sections
- [styles.css](styles.css): dashboard styling, responsive layout, compact executive-style design, and table formatting
- [script.js](script.js): forecast logic, ingredient requirement conversion, order-plan optimization, inventory balance calculation, cost breakdown, and sensitivity testing
- [streamlit_app.py](streamlit_app.py): Streamlit dashboard and SciPy HiGHS LP optimization model
- [requirements.txt](requirements.txt): Python packages required for local and Streamlit Cloud deployment
- [.streamlit/config.toml](.streamlit/config.toml): deployment theme and server configuration
- [.gitignore](.gitignore): excludes virtual environments and local editor files
- [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md): GitHub and Streamlit Community Cloud upload guide
- [PROJECT_DEVELOPMENT_GUIDE.md](PROJECT_DEVELOPMENT_GUIDE.md): project development, Agent collaboration, LP model, page structure, and deployment documentation

## 7. Expected usage

This prototype is suitable for:

- project proposal presentation
- prototype demonstration in class
- interactive demand and inventory planning discussion
- manager scenario testing for purchasing decisions
- dashboard walkthroughs for business planning and cost trade-offs

## 8. Final notes

This is a prototype for demonstration and academic project use. It is intended to communicate the project logic clearly and visually, while showing how a manager can evaluate demand changes, order timing, and inventory cost trade-offs in an interactive dashboard. The current version reflects the final, reconciled logic used in the prototype, including the explicit separation of order cost and holding cost in the weekly total cost calculation.
