import React from "react";

type MenuProps = {
  userName: string;
  onLogout: () => void;
  onNavigate: (page: "shuffler") => void;
};

const Menu: React.FC<MenuProps> = ({ userName, onLogout, onNavigate }) => {
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>welcome, {userName}</h2>
      <button onClick={() => onNavigate("shuffler")}>shuffle</button>
      <br /><br />
      <button onClick={onLogout}>logout</button>
    </div>
  );
};

export default Menu;
