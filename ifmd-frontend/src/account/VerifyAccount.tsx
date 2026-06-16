import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { WSS_URL } from '../constants';

function Verify() {
    const { code } = useParams();
    const navigate = useNavigate();

    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');

    let firstRun = false

    useEffect(() => {
        async function verifyAccount() {
            if (firstRun) return;

            try {
                firstRun = true;

                const response = await fetch(
                    `wss://${WSS_URL}/api/account/verify/${encodeURIComponent(code ?? "NO_CODE")}`
                )
                const data = await response.json();

                if (response.ok) {
                    setStatus('success');
                } else {
                    setStatus('error');
                    setMessage(data.msg)
                }
            } catch (err) {
                setStatus('error');
            }
        }

        verifyAccount();
    }, [code]);

    // Redirect
    useEffect(() => {
        if (status == 'loading') return;

        const timer = setTimeout(() => {
            navigate('/');
        }, 5000);

        return () => clearTimeout(timer);
    }, [status, navigate])

    let msg = ""

    if (status == 'loading') {msg = "Verifying..."}
    if (status === 'success') {msg = "Verified! Redirecting to authentication in 5 seconds..."}

    if (status == "loading" || status == "success") {
        return <div className='text-white text-center mt-5 text-5xl'>{msg}</div>
    }

    return (
        <div className='text-white text-center font-bold mt-5 text-4xl grid grid-cols-1'>
        <p>Account Authentication Failed: {message}</p>
        <p>Redirecting to home in 5 seconds...</p>
        </div>
    );
}


export default Verify;
