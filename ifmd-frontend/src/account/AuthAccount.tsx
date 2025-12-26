import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function App() {
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    email: "",
    password: ""
  });

  const [message, setMessage] = useState("message")

  const navigate = useNavigate();


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

      // If the account was authenticated set the message to auth and redirect to the root page
      if (response.ok) {
        setMessage("auth")

        Cookies.set('token', data["token"])

        setTimeout(() => {navigate("/")}, 3000)
      } else {
        alert("Account Authentication Failed: " + data["msg"]);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  if (message == "message") {
    return <><h1 className='text-center m-auto font-bold text-5xl mb-20 mt-5 text-white'>Authentication</h1>
    <div className='text-center text-white text-xl'>
      <form onSubmit={handleSubmit}>
        <label>
          Enter your username:
          <input
            className='bg-(--main-color) rounded-xl mb-2'
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange} />
        </label>

        <br></br>
        <label>
          Enter your password:
          <input
            className='bg-(--main-color) rounded-xl mb-2'
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange} />
        </label>

        <br></br>

        <input type="submit" className='mt-10 bg-(--main-color) rounded-lg p-1' value="Submit" />
      </form>
    </div>
    </>
  } else if (message == "auth") {
    return <center><h1 className='text-center font-bold text-7xl text-white mt-20'>Account Authenticated!</h1></center>
  }
}

export default App;
