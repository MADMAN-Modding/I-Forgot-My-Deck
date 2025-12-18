import { useState } from 'react';
import './App.css'

function App() {
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    email: "",
    password: ""
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch(`http://127.0.0.1:3000/api/account/auth/${form.username}/${form.password}`);

      const data = await response.json();
      console.log("Response:", data);

      if (response.ok) {
        alert("Account Authenticated!");
      } else {
        alert("Account Authentication Failed: " + data["msg"]);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  return (
    <><center><h1>Auth</h1></center><form onSubmit={handleSubmit}>
      <label>
        Enter your username:
        <input
          type="text"
          name="username"
          value={form.username}
          onChange={handleChange} />
      </label>

      <label>
        Enter your password:
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange} />
      </label>

      <input type="submit" value="Submit" />
    </form></>
  );
}

export default App;
