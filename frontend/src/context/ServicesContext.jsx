import { createContext, useContext, useReducer, useEffect } from 'react';
import { loadServices, saveServices } from '../utils/storage';

const ServicesContext = createContext(null);
const ServicesDispatchContext = createContext(null);

const initialState = {
  services: [],
  statuses: {},
};

function servicesReducer(state, action) {
  switch (action.type) {
    case 'LOAD_SERVICES': {
      return {
        ...state,
        services: action.payload,
      };
    }
    case 'ADD_SERVICE': {
      const newServices = [...state.services, action.payload];
      return {
        ...state,
        services: newServices,
      };
    }
    case 'UPDATE_SERVICE': {
      const updatedServices = state.services.map((service) =>
        service.id === action.payload.id ? action.payload : service
      );
      return {
        ...state,
        services: updatedServices,
      };
    }
    case 'DELETE_SERVICE': {
      const filteredServices = state.services.filter(
        (service) => service.id !== action.payload
      );
      const { [action.payload]: _, ...remainingStatuses } = state.statuses;
      return {
        ...state,
        services: filteredServices,
        statuses: remainingStatuses,
      };
    }
    case 'UPDATE_STATUS': {
      return {
        ...state,
        statuses: {
          ...state.statuses,
          [action.payload.id]: action.payload.status,
        },
      };
    }
    default:
      return state;
  }
}

export function ServicesProvider({ children }) {
  const [state, dispatch] = useReducer(servicesReducer, initialState);

  useEffect(() => {
    const savedServices = loadServices();
    if (savedServices.length > 0) {
      dispatch({ type: 'LOAD_SERVICES', payload: savedServices });
    }
  }, []);

  useEffect(() => {
    saveServices(state.services);
  }, [state.services]);

  return (
    <ServicesContext.Provider value={state}>
      <ServicesDispatchContext.Provider value={dispatch}>
        {children}
      </ServicesDispatchContext.Provider>
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (context === null) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}

export function useServicesDispatch() {
  const context = useContext(ServicesDispatchContext);
  if (context === null) {
    throw new Error('useServicesDispatch must be used within a ServicesProvider');
  }
  return context;
}
