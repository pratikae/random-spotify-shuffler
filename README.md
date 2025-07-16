spotify shuffler
features: true random shuffle, bundles, search by category (wip)

- download code, open in vscode
- install nodejs and python
- backend, enter in terminal:
  - cd server
  - install dependencies: pip install flask spotipy python-dotenv apscheduler
  - set up venv:
    - python -m venv venv 
    - source venv/bin/activate
  - create .env, get id and secrets from me:
    - SPOTIPY_CLIENT_ID=your_id_here
      SPOTIPY_CLIENT_SECRET=your_secret_here
      SPOTIPY_REDIRECT_URI=http://127.0.0.1:8888/callback
  - run app: python app.py
- frontend, enter in terminal:
  - cd client
  - install dependencies: npm install react axios
  - run app: npm run start

login with your spotify account, and you are good to go!
