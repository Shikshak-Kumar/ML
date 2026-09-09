# Mental Health Signal

A full-stack machine-learning application that estimates a mental health score from daily digital habits, study patterns, sleep, physical activity, and perceived stress.

The project is split into two deployable parts:

- `frontend/`: React + Vite interface
- `backend/`: FastAPI prediction service and saved scikit-learn model

## Project Structure

```text
.
├── backend/
│   ├── main.py
│   ├── Mental_Health_Model.pkl
│   └── requirements.txt
└── frontend/
    ├── src/
    ├── public/
    ├── package.json
    └── .env
```

## Backend

Create and activate a Python environment, then install the backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # macOS/Linux
# .venv\\Scripts\\activate    # Windows
pip install -r requirements.txt
```

Start the API from the `backend` directory:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`.

The model file is loaded relative to `main.py`, so the backend can also be started from the repository root with:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Frontend

Install dependencies and start the development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend reads the backend URL from `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

For deployment, set `VITE_API_URL` to the public backend URL before building:

```bash
VITE_API_URL=https://your-backend.example.com npm run build
```

The generated production files are written to `frontend/dist`.

## Prediction Endpoint

`POST /predict` accepts a JSON payload with the following fields:

```json
{
  "age": 21,
  "gender": "Female",
  "country": "India",
  "academic_level": "Undergraduate",
  "most_used_platform": "Instagram",
  "purpose_of_use": "Entertainment",
  "avg_daily_usage_hours": 4.5,
  "daily_unlocks": 60,
  "study_hours": 5.0,
  "physical_activity_hours": 1.0,
  "sleep_hours_per_night": 7.5,
  "stress_level": "Medium"
}
```

The response is structured JSON:

```json
{
  "predicted_mental_health_score": 6.42
}
```

The score is a model prediction and is not a medical diagnosis.

## Production Checklist

1. Deploy the backend with the contents of `backend/` and install `backend/requirements.txt`.
2. Set the frontend `VITE_API_URL` to the deployed backend URL.
3. Run `npm run build` inside `frontend/`.
4. Deploy the contents of `frontend/dist` as a static site.
5. Configure the backend CORS policy for the deployed frontend origin instead of using a wildcard in a production environment.
