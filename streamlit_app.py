import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from scipy.optimize import linprog

st.set_page_config(page_title="Amazing Coffee | Forecasting & Inventory Planning", page_icon="AC", layout="wide")

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
PRODUCTS = ["Cappuccino", "Latte", "Mocha"]
INGREDIENTS = ["Coffee Bean", "Milk Foam", "Steamed Milk", "Chocolate Powder"]

BASE_DEMAND = {
    "Monday": {"Cappuccino": 51, "Latte": 80, "Mocha": 55},
    "Tuesday": {"Cappuccino": 47.5, "Latte": 43, "Mocha": 45.5},
    "Wednesday": {"Cappuccino": 55.5, "Latte": 56.5, "Mocha": 58.5},
    "Thursday": {"Cappuccino": 113, "Latte": 94, "Mocha": 131},
    "Friday": {"Cappuccino": 136.5, "Latte": 120.5, "Mocha": 165},
    "Saturday": {"Cappuccino": 112, "Latte": 139.5, "Mocha": 131.5},
    "Sunday": {"Cappuccino": 69, "Latte": 64.33, "Mocha": 82.67},
}

INGREDIENT_MATRIX = {
    "Coffee Bean": {"Cappuccino": 0.04, "Latte": 0.025, "Mocha": 0.03},
    "Milk Foam": {"Cappuccino": 0.01, "Latte": 0.005, "Mocha": 0},
    "Steamed Milk": {"Cappuccino": 0.01, "Latte": 0.02, "Mocha": 0.02},
    "Chocolate Powder": {"Cappuccino": 0, "Latte": 0, "Mocha": 0.015},
}

INGREDIENT_COST = {"Coffee Bean": 14, "Milk Foam": 8, "Steamed Milk": 6, "Chocolate Powder": 5}
ORDER_DAYS = {"Monday", "Thursday", "Saturday"}


def get_ingredient_demand(demand):
    result = {}
    for ingredient in INGREDIENTS:
        result[ingredient] = {
            day: sum(demand[day][product] * INGREDIENT_MATRIX[ingredient][product] for product in PRODUCTS)
            for day in WEEKDAYS
        }
    return result


def solve_lp(demand, discount_pct, holding_multiplier):
    ingredient_demand = get_ingredient_demand(demand)
    discount = discount_pct / 100
    holding_rate = 0.10

    all_order_schedule = {}
    all_inventory = {}
    all_rows = []

    total_order_cost = 0
    total_holding_cost = 0

    for ingredient in INGREDIENTS:
        n = len(WEEKDAYS)
        # Variables: 7 order quantities, then 7 ending inventories.
        c = np.zeros(2 * n)
        for day_index, day in enumerate(WEEKDAYS):
            unit_cost = INGREDIENT_COST[ingredient]
            if day == "Thursday":
                unit_cost *= 1 - discount
            c[day_index] = unit_cost
            c[n + day_index] = INGREDIENT_COST[ingredient] * holding_rate * holding_multiplier

        A_eq = []
        b_eq = []

        for day_index, day in enumerate(WEEKDAYS):
            row = np.zeros(2 * n)
            row[day_index] = 1
            row[n + day_index] = -1
            if day_index > 0:
                row[n + day_index - 1] = 1

            A_eq.append(row)
            b_eq.append(ingredient_demand[ingredient][day])

        A_ub = []
        b_ub = []

        for day_index, day in enumerate(WEEKDAYS):
            if day not in ORDER_DAYS:
                row = np.zeros(2 * n)
                row[day_index] = 1
                A_ub.append(row)
                b_ub.append(0)

        bounds = [(0, None)] * (2 * n)
        solution = linprog(c, A_ub=A_ub if A_ub else None, b_ub=b_ub if b_ub else None,
                           A_eq=np.array(A_eq), b_eq=np.array(b_eq), bounds=bounds, method="highs")

        if not solution.success:
            raise RuntimeError(f"LP solver failed for {ingredient}: {solution.message}")

        order_qty = solution.x[:n]
        ending_inv = solution.x[n:]

        ingredient_order_cost = 0
        ingredient_holding_cost = 0
        inventory_row = {}

        for day_index, day in enumerate(WEEKDAYS):
            unit_cost = INGREDIENT_COST[ingredient] * (1 - discount if day == "Thursday" else 1)
            ingredient_order_cost += order_qty[day_index] * unit_cost
            daily_holding = ending_inv[day_index] * INGREDIENT_COST[ingredient] * holding_rate * holding_multiplier
            ingredient_holding_cost += daily_holding

            opening_inv = 0 if day_index == 0 else ending_inv[day_index - 1]
            inventory_row[day] = {
                "Opening inv.": max(0, opening_inv),
                "Consumed qty": ingredient_demand[ingredient][day],
                "Ending inv.": max(0, ending_inv[day_index]),
                "Holding cost": daily_holding,
            }

            quantity = max(0, order_qty[day_index])
            all_rows.append({
                "Ingredient": ingredient,
                "Day": day,
                "LP order decision": "Order" if quantity > 0.005 else "No order",
                "Order quantity (kg)": quantity,
                "Consumed qty (kg)": ingredient_demand[ingredient][day],
                "Opening inv. (kg)": max(0, opening_inv),
                "Ending inv. (kg)": max(0, ending_inv[day_index]),
            })

        all_order_schedule[ingredient] = {day: max(0, order_qty[i]) for i, day in enumerate(WEEKDAYS)}
        all_inventory[ingredient] = inventory_row
        total_order_cost += ingredient_order_cost
        total_holding_cost += ingredient_holding_cost

    return {
        "ingredient_demand": ingredient_demand,
        "order_schedule": all_order_schedule,
        "inventory": all_inventory,
        "detail_rows": pd.DataFrame(all_rows),
        "order_cost": total_order_cost,
        "holding_cost": total_holding_cost,
        "total_cost": total_order_cost + total_holding_cost,
    }


st.markdown("""
<style>
:root {
  --ink: #132238;
  --muted: #67758b;
  --line: #dfe7f4;
  --soft: #edf3ff;
  --blue: #274c77;
  --blue-2: #3a7bd5;
}
[data-testid="stHeader"] { background: rgba(255,255,255,0); }
[data-testid="stAppViewContainer"] { background: linear-gradient(180deg, #eef4ff 0%, #f9fbff 100%); }
.block-container { max-width: 1280px; padding-top: 1.5rem; padding-bottom: 3rem; }
.brand { display:flex; align-items:center; gap:.8rem; }
.brand-mark { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:linear-gradient(135deg,#274c77,#3a7bd5); color:white; font-weight:800; }
.brand-name { font-weight:800; color:#132238; }
.brand-kicker { font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; color:#67758b; }
.hero { display:grid; grid-template-columns:1.65fr 1.35fr; gap:16px; margin:18px 0 16px; }
.hero-copy, .hero-metrics, .panel { background:white; border:1px solid var(--line); border-radius:18px; box-shadow:0 14px 36px rgba(19,34,56,.07); }
.hero-copy { padding:24px 26px; }
.hero-copy h1 { font-size:2.05rem; line-height:1.12; margin:.35rem 0 .8rem; }
.hero-copy p { color:var(--muted); line-height:1.55; }
.hero-metrics { display:grid; grid-template-columns:repeat(3,1fr); padding:14px; gap:10px; }
.metric { border:1px solid var(--line); border-radius:14px; background:#f7faff; padding:13px; }
.metric.accent { background:#fff8e7; }
.metric label { color:var(--muted); font-size:.75rem; display:block; }
.metric strong { display:block; color:var(--ink); font-size:1.18rem; margin:.35rem 0; }
.metric small { color:var(--muted); }
.panel { padding:18px; margin-bottom:16px; }
.panel h2 { font-size:1.25rem; margin:0 0 10px; }
.eyebrow { color:#67758b; text-transform:uppercase; letter-spacing:.10em; font-size:.72rem; font-weight:800; }
.function-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.function-card { border:1px solid var(--line); border-radius:14px; background:#f8fbff; padding:12px; }
.function-card .num { width:28px; height:28px; border-radius:8px; background:#edf3ff; display:grid; place-items:center; color:#274c77; font-size:.72rem; font-weight:800; margin-bottom:8px; }
.function-card h3 { font-size:.86rem; margin:0 0 5px; }
.function-card p { font-size:.72rem; color:#67758b; line-height:1.45; margin:0; }
[data-testid="stMetric"] { background:white; border:1px solid var(--line); border-radius:14px; padding:12px; }
@media (max-width: 900px) { .hero { grid-template-columns:1fr; } .hero-metrics { grid-template-columns:1fr; } .function-grid { grid-template-columns:repeat(2,1fr); } }
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div class="brand">
  <div class="brand-mark">AC</div>
  <div>
    <div class="brand-kicker">SCM6111</div>
    <div class="brand-name">Amazing Coffee</div>
  </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="hero">
  <div class="hero-copy">
    <div class="eyebrow">Data-Driven Forecasting & Inventory Optimization</div>
    <h1>Weekly demand forecast and ingredient ordering plan</h1>
    <p>The system combines next-week demand, ingredient recipes, supplier discount, and holding cost to recommend a minimum-cost weekly procurement plan.</p>
  </div>
  <div class="hero-metrics">
    <div class="metric"><label>Demand horizon</label><strong>7 days</strong><small>Weekly view</small></div>
    <div class="metric accent"><label>LP optimizer</label><strong>SciPy HiGHS</strong><small>Minimum-cost plan</small></div>
    <div class="metric"><label>Order windows</label><strong>Mon / Thu / Sat</strong><small>Discount-aware</small></div>
  </div>
</div>
""", unsafe_allow_html=True)

st.markdown("""
<div class="panel">
  <div class="eyebrow">Key functions</div>
  <h2>Core decision support</h2>
  <div class="function-grid">
    <div class="function-card"><div class="num">01</div><h3>Forecast engine</h3><p>Uses weekday demand inputs and promotion scenarios for next-week forecasting.</p></div>
    <div class="function-card"><div class="num">02</div><h3>Material planner</h3><p>Converts beverage demand into coffee, milk, and chocolate requirements.</p></div>
    <div class="function-card"><div class="num">03</div><h3>LP ordering model</h3><p>Minimizes order cost and holding cost with inventory-balance constraints.</p></div>
    <div class="function-card"><div class="num">04</div><h3>Sensitivity testing</h3><p>Tests demand, supplier discount, and holding-cost assumptions.</p></div>
  </div>
</div>
""", unsafe_allow_html=True)

left, right = st.columns([0.92, 1.08], gap="medium")

with left:
    st.markdown('<div class="panel">', unsafe_allow_html=True)
    st.markdown('<div class="eyebrow">User interface</div><h2>Manager planning controls</h2>', unsafe_allow_html=True)

    demand = {day: {} for day in WEEKDAYS}
    demand_grid = st.columns(2)
    for index, day in enumerate(WEEKDAYS):
        with demand_grid[index % 2]:
            st.markdown(f"**{day}**")
            for product in PRODUCTS:
                demand[day][product] = st.number_input(
                    product,
                    min_value=0,
                    value=int(round(BASE_DEMAND[day][product])),
                    step=1,
                    key=f"{day}_{product}",
                )

    st.markdown('</div>', unsafe_allow_html=True)

with right:
    st.markdown('<div class="panel">', unsafe_allow_html=True)
    st.markdown('<div class="eyebrow">Forecast result</div><h2>Next-week demand by product</h2>', unsafe_allow_html=True)

    chart = go.Figure()
    colors = {"Cappuccino": "#3a7bd5", "Latte": "#f59e0b", "Mocha": "#1faa7a"}
    for product in PRODUCTS:
        chart.add_trace(go.Scatter(
            x=WEEKDAYS,
            y=[demand[day][product] for day in WEEKDAYS],
            mode="lines+markers",
            name=product,
            line=dict(color=colors[product], width=3),
            marker=dict(size=7),
        ))

    chart.update_layout(height=350, margin=dict(l=20, r=20, t=20, b=20), hovermode="x unified",
                        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    chart.update_yaxes(title="Demand (cups)", gridcolor="#dfe7f4")
    chart.update_xaxes(gridcolor="#edf3ff")
    st.plotly_chart(chart, use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

st.markdown('<div class="panel">', unsafe_allow_html=True)
st.markdown('<div class="eyebrow">Sensitivity</div><h2>Scenario testing</h2>', unsafe_allow_html=True)
scenario_left, scenario_mid, scenario_right = st.columns(3)
with scenario_left:
    discount_pct = st.slider("Supplier discount", 0, 30, 15)
with scenario_mid:
    holding_multiplier = st.slider("Holding cost multiplier", 0.5, 2.0, 1.0, 0.1)
with scenario_right:
    demand_change_pct = st.slider("Demand change", -20, 30, 0)

scenario_demand = {
    day: {
        product: demand[day][product] * (1 + demand_change_pct / 100)
        for product in PRODUCTS
    }
    for day in WEEKDAYS
}

run_forecast = st.button("Run Forecast", type="primary", use_container_width=True)

if run_forecast:
    st.session_state["run_result"] = solve_lp(scenario_demand, discount_pct, holding_multiplier)

if "run_result" not in st.session_state:
    st.session_state["run_result"] = solve_lp(scenario_demand, discount_pct, holding_multiplier)

result = st.session_state["run_result"]
st.markdown('</div>', unsafe_allow_html=True)

cost_left, cost_mid, cost_right = st.columns(3)
cost_left.metric("Ingredient order cost", f"${result['order_cost']:,.2f}")
cost_mid.metric("Holding cost", f"${result['holding_cost']:,.2f}")
cost_right.metric("Weekly total cost", f"${result['total_cost']:,.2f}")

order_left, inventory_right = st.columns([1.18, 0.82], gap="medium")

with order_left:
    st.markdown('<div class="panel">', unsafe_allow_html=True)
    st.markdown('<div class="eyebrow">Result</div><h2>Projected order plan</h2>', unsafe_allow_html=True)

    required_rows = []
    for ingredient in INGREDIENTS:
        required = sum(result["ingredient_demand"][ingredient].values())
        positive_days = [day for day in WEEKDAYS if result["order_schedule"][ingredient][day] > 0.005]
        lp_order_days = ", ".join(positive_days) if positive_days else "No order"
        total_order_qty = sum(result["order_schedule"][ingredient].values())

        purchase_cost = 0
        for day in positive_days:
            unit_cost = INGREDIENT_COST[ingredient] * (1 - discount_pct / 100 if day == "Thursday" else 1)
            purchase_cost += result["order_schedule"][ingredient][day] * unit_cost

        effective_unit_cost = purchase_cost / total_order_qty if total_order_qty > 0.005 else 0
        required_rows.append({
            "Ingredient": ingredient,
            "Required (kg)": round(required, 2),
            "LP order day(s)": lp_order_days,
            "Effective unit cost": f"${effective_unit_cost:.2f}",
        })
    st.dataframe(pd.DataFrame(required_rows), use_container_width=True, hide_index=True)

    lp_order_days = {
        ingredient: [
            day for day in ["Monday", "Thursday", "Saturday"]
            if result["order_schedule"][ingredient][day] > 0.005
        ]
        for ingredient in INGREDIENTS
    }

    active_order_days = []
    for ingredient in INGREDIENTS:
        for day in lp_order_days[ingredient]:
            if day not in active_order_days:
                active_order_days.append(day)

    schedule_rows = []
    for ingredient in INGREDIENTS:
        ingredient_row = {"Ingredient": ingredient}
        for day in active_order_days:
            qty = result["order_schedule"][ingredient][day]
            ingredient_row[day] = f"{qty:.2f} kg" if qty > 0.005 else "-"

        total_qty = sum(
            result["order_schedule"][ingredient][day]
            for day in lp_order_days[ingredient]
        )
        ingredient_row["Total"] = round(total_qty, 2)
        schedule_rows.append(ingredient_row)
    st.markdown("**Order schedule**")
    st.caption("Columns show only the order days selected by LP across ingredients.")
    st.dataframe(pd.DataFrame(schedule_rows), use_container_width=True, hide_index=True)

    st.markdown('</div>', unsafe_allow_html=True)

with inventory_right:
    st.markdown('<div class="panel">', unsafe_allow_html=True)
    st.markdown('<div class="eyebrow">Inventory</div><h2>Inventory balance</h2>', unsafe_allow_html=True)
    selected_day = st.selectbox("Select day", WEEKDAYS, index=0)

    inventory_rows = []
    for ingredient in INGREDIENTS:
        data = result["inventory"][ingredient][selected_day]
        inventory_rows.append({
            "Ingredient": ingredient,
            "Opening inv.": f"{data['Opening inv.']:.2f} kg",
            "Consumed qty": f"{data['Consumed qty']:.2f} kg",
            "Ending inv.": f"{data['Ending inv.']:.2f} kg",
            "Holding cost": f"${data['Holding cost']:.2f}",
        })
    st.dataframe(pd.DataFrame(inventory_rows), use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)

