random spotofy shuffler (and more to come??)

- clone the repo in terminal:
  - git clone https://github.com/your-username/spotify-random-shuffler.git
    cd spotify-random-shuffler
- backend, enter in terminal:
  - cd server
  - install dependencies: pip install flask spotipy python-dotenv apscheduler
  - create venv: python -m venv venv
                 source venv/bin/activate
  - create .env, get id and secrets from me:
    - SPOTIPY_CLIENT_ID=your_id_here
      SPOTIPY_CLIENT_SECRET=your_secret_here
      SPOTIPY_REDIRECT_URI=http://localhost:8888/callback
  - run app: python app.py
- frontend, enter in terminal:
  - cd client
  - install dependencies: react react-dom axios @types/react @types/react-dom
  - run app: npm run start

login with your spotify account, and you are good to go!
