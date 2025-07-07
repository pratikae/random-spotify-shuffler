import React from "react";

const Login: React.FC = () => {
  const handleLogin = () => {
    window.location.href = "http://localhost:8888/login";
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>welcome to random spotify shuffler</h2>
      <button onClick={handleLogin}>login with spotify</button>
    </div>
  );
};

export default Login;
