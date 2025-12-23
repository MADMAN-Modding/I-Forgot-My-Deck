import './home.css'

function Home() {
    return (
        <>

            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#news">Updates</a></li>
                <li><a href="https://github.com/MADMAN-Modding/I-Forgot-My-Deck" target='blank'>GitHub</a></li>
                <li><a href="#about">About</a></li>
                <li id='login'><a href="account/auth/">Login</a></li>
                <li id='signup'><a href="account/create">Signup</a></li>
            </ul>

            <div className='bg-center text-3xl font-bold text-white text-center'>
                <h1>You forgot your deck, didn't you?</h1>

                <h2 className='text-xl'>That's ok! Add your deck <a className='underline' href=''>here</a>!</h2>
            </div>
        </>
    )
}

export default Home