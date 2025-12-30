import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// index.js বা App.js এ
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';


const root = ReactDOM.createRoot(document.getElementById('root'));
let theme = createTheme({
  typography: {
    fontSize: 14,
  },
  components: {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
        },
      },
    },
  },
});
theme = responsiveFontSizes(theme);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
