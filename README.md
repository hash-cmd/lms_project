# UPSA Student Project Management System

A mobile and backend system for University of Professional Studies, Accra (UPSA) students to manage academic projects, built with React Native (Expo) and Django REST framework.

## Features

- Student authentication (registration/login)
- Project creation and management
- Task assignment and tracking
- Deadline notifications
- Document upload/sharing

## Technologies

**Frontend:**
- React Native (Expo)
- React Navigation
- Axios for API calls
- React Context API (or Redux) for state management

**Backend:**
- Django REST framework
- PostgreSQL (or SQLite for development)
- JWT Authentication
- CORS headers

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- Python (3.8+)
- Expo CLI (`npm install -g expo-cli`)
- PostgreSQL (for production)

git clone https://github.com/hash-cmd/lms_project

### Frontend Setup
cd lms_project/lms
npm install
npx expo start


### Backend Setup
cd lms_project/lms
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser

# Start the development server
python manage.py runserver
