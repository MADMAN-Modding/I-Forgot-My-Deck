import { useNavigate, useParams } from 'react-router-dom';
import './Account.css'
import { useEffect, useState } from 'react';

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

                console.log("Searching for: " + code)

                const response = await fetch(
                    `http://127.0.0.1:3000/api/account/verify/${encodeURIComponent(code)}`
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
                setMessage(err.message)
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

    if (status == 'loading') return <div>Verifying...</div>
    if (status === 'success') return <div>Verified! Redirecting to authentication in 5 seconds...</div>;

    return (
        <div>
        Account Authentication Failed: {message}
        <br />
        Redirecting to home in 5 seconds...
        </div>
    );
}


export default Verify;
