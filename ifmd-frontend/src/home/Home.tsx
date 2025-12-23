function Home() {
    return (
        <>
            <div className="mt-4 flex flex-wrap bg-[#333333] text-white w-2/3 m-auto rounded-2xl *:hover:bg-(--main-color) *:transition *:duration-400 *:rounded-xl *:m-auto *:pl-1 *:pr-1">
                <a href="/">Home</a>
                <a href="#news">Updates</a>
                <a href="https://github.com/MADMAN-Modding/I-Forgot-My-Deck" target='blank'>GitHub</a>
                <a href="#about">About</a>
                <a href="account/auth/">Login</a>
                <a href="account/create">Signup</a>
            </div>

            <div className='bg-center text-3xl font-bold text-white text-center mt-5'>
                <h1>You forgot your deck, didn't you?</h1>

                <h2 className='text-xl'>That's ok! Add your deck <a className='underline' href=''>here</a>!</h2>
            </div>
        </>
    )
}

export default Home