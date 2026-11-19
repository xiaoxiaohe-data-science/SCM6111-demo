# Deploy to Streamlit Community Cloud

## 1. Upload the project

Create a GitHub repository and upload the project files. Do not upload `.venv/`, `.DS_Store`, or local Streamlit secrets.

Recommended repository files:

- `streamlit_app.py`
- `requirements.txt`
- `.gitignore`
- `.streamlit/config.toml`
- `README.md`

Optional files:

- `index.html`
- `styles.css`
- `script.js`
- project data and source documents

## 2. Create the Streamlit app

1. Open Streamlit Community Cloud.
2. Sign in with GitHub.
3. Select **Create app**.
4. Choose the repository and branch.
5. Set the **Main file path** to `streamlit_app.py`.
6. Select **Deploy**.

Streamlit will install the packages in `requirements.txt` and start the app.

## 3. Run locally before deployment

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run streamlit_app.py
```

On Windows, activate the virtual environment with:

```powershell
.venv\Scripts\activate
```

## 4. Public or private access

The free Community Cloud plan can publish a public app. Use private or paid deployment if the project contains confidential data or requires restricted access.
