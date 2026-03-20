import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/globals.css';
import App from './App';
import { useStore } from './store/useStore';

function Bootstrap({ children }: { children: React.ReactNode }) {
	const initAuthListener = useStore((s) => s.initAuthListener);
	const setTheme = useStore((s) => s.setTheme);

	React.useEffect(() => {
		const unsubscribe = initAuthListener();
		return () => unsubscribe();
	}, [initAuthListener]);

	React.useEffect(() => {
		const savedTheme = (localStorage.getItem('nexus-theme') as 'dark' | 'light') || 'dark';
		setTheme(savedTheme);
	}, [setTheme]);

	return <>{children}</>;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<BrowserRouter>
			<Bootstrap>
				<App />
			</Bootstrap>
		</BrowserRouter>
	</React.StrictMode>
);
