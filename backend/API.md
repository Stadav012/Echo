# API Documentation

## Base URL
```
http://localhost:3001
```

## Endpoints

### Health Check

Check if the server is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "message": "Survey AI Backend is running"
}
```

---

### Get All Surveys

Retrieve all surveys.

**Endpoint:** `GET /api/survey`

**Response:**
```json
{
  "message": "Survey endpoint",
  "surveys": []
}
```

---

### Create Survey

Create a new survey.

**Endpoint:** `POST /api/survey`

**Request Body:**
```json
{
  "title": "Customer Satisfaction Survey",
  "description": "Help us improve our services",
  "questions": [
    {
      "id": "q1",
      "type": "rating",
      "question": "How satisfied are you with our service?",
      "required": true
    },
    {
      "id": "q2",
      "type": "voice",
      "question": "What can we improve?",
      "required": false
    }
  ]
}
```

**Response:**
```json
{
  "message": "Survey created",
  "data": {
    "title": "Customer Satisfaction Survey",
    "description": "Help us improve our services",
    "questions": [...]
  }
}
```

**Status Code:** `201 Created`

---

### Voice Processing

Process voice input (coming soon).

**Endpoint:** `POST /api/voice`

**Response:**
```json
{
  "message": "Voice processing endpoint - coming soon"
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "error": "Not found"
}
```

## CORS

The API accepts requests from all origins (`*`) in development mode. In production, configure the `CORS_ORIGIN` environment variable to restrict access.

## Rate Limiting

Currently, there is no rate limiting implemented. This should be added before production deployment.

## Authentication

Authentication is not yet implemented. This will be added in future versions.
