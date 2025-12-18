import { useState } from 'react';
import './App.css'

function CreateAccount() {
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
      const response = await fetch(`http://127.0.0.1:3000/api/account/create/${encodeURIComponent(form.display_name)}/${form.username}/${form.email}/${form.password}`);

      const data = await response.json();
      console.log("Response:", data);

      if (response.ok) {
        alert("Registration Complete!");
      } else {
        alert("Registration Failed: " + data);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  return (
    <><br></br><center><h1>Create an Account</h1></center><form onSubmit={handleSubmit}>
      <label>
        Enter your display name:
        <input
          type="text"
          name="display_name"
          value={form.display_name}
          onChange={handleChange} />
      </label>

      <label>
        Enter your username:
        <input
          type="text"
          name="username"
          value={form.username}
          onChange={handleChange} />
      </label>

      <label>
        Enter your email:
        <input
          type="email"
          name="email"
          value={form.email}
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

export default CreateAccount;
