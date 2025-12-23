import { useState } from 'react';

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
        alert("Registration Complete!\nPlease check your email for verification.");
      } else {
        alert("Registration Failed: " + data);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  return (
    <><br></br><center><h1 className='text-center mt-5 font-bold text-5xl mb-20 text-white'>Create an Account</h1></center>
      <div className='text-center text-xl'>
        <form onSubmit={handleSubmit} className='text-white'>
          <label>
            Enter your display name:
            <input
              className='bg-(--main-color) rounded-xl mb-2'
              type="text"
              name="display_name"
              value={form.display_name}
              onChange={handleChange} />
          </label>
          <br></br>

          <label>
            Enter your email:
            <input
              className='bg-(--main-color) rounded-xl mb-2'
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange} />
          </label>
          <br></br>

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
      </div></>
  );
}

export default CreateAccount;
