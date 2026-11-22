import React from 'react';
import {createRoot} from 'react-dom/client';
import Planner from './app/planner';
import './app/globals.css';
createRoot(document.getElementById('planner')!).render(<Planner/>);
