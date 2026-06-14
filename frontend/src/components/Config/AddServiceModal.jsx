import { useState } from 'react';
import { useServicesDispatch } from '../../context/ServicesContext';
import './AddServiceModal.css';

export function AddServiceModal({ onClose, onServiceAdded }) {
  const dispatch = useServicesDispatch();
  const [step, setStep] = useState('choose'); // 'choose', 'rest', 'cli'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [restForm, setRestForm] = useState({
    name: '',
  });

  const [cliForm, setCliForm] = useState({
    name: '',
  });

  const [errors, setErrors] = useState({});

  const validateRestForm = () => {
    const newErrors = {};
    if (!restForm.name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCliForm = () => {
    const newErrors = {};
    if (!cliForm.name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRestSubmit = () => {
    if (!validateRestForm()) return;

    setIsSubmitting(true);
    const service = {
      id: Date.now().toString(),
      type: 'rest',
      name: restForm.name.trim(),
    };

    dispatch({ type: 'ADD_SERVICE', payload: service });
    onServiceAdded?.(service.id);
    onClose();
  };

  const handleCliSubmit = () => {
    if (!validateCliForm()) return;

    setIsSubmitting(true);
    const service = {
      id: Date.now().toString(),
      type: 'cli',
      name: cliForm.name.trim(),
    };

    dispatch({ type: 'ADD_SERVICE', payload: service });
    onServiceAdded?.(service.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-service-modal" onClick={e => e.stopPropagation()}>
        {step === 'choose' && (
          <>
            <h2>Add New Service</h2>
            <p className="modal-description">What type of service do you want to monitor?</p>

            <div className="type-choices">
              <button className="type-card" onClick={() => setStep('rest')}>
                <div className="type-icon rest">API</div>
                <h3>REST API</h3>
                <p>Monitor HTTP endpoints with health checks, synthetic transactions, and load testing</p>
              </button>

              <button className="type-card" onClick={() => setStep('cli')}>
                <div className="type-icon cli">$_</div>
                <h3>CLI Tool</h3>
                <p>Validate command-line tools with test suites and output verification</p>
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === 'rest' && (
          <>
            <h2>Add REST API Service</h2>
            <p className="modal-description">Name your service. You can configure a health check endpoint later.</p>

            <div className="form-group">
              <label htmlFor="name">Service Name</label>
              <input
                id="name"
                type="text"
                value={restForm.name}
                onChange={e => setRestForm({ ...restForm, name: e.target.value })}
                placeholder="My API Service"
              />
              {errors.name && <span className="error">{errors.name}</span>}
            </div>

            <div className="modal-actions">
              <button className="btn-back" onClick={() => setStep('choose')}>Back</button>
              <button className="btn-submit" onClick={handleRestSubmit} disabled={isSubmitting}>
                Add Service
              </button>
            </div>
          </>
        )}

        {step === 'cli' && (
          <>
            <h2>Add CLI Tool</h2>
            <p className="modal-description">Create a test suite for your command-line tool</p>

            <div className="form-group">
              <label htmlFor="cli-name">Test Suite Name</label>
              <input
                id="cli-name"
                type="text"
                value={cliForm.name}
                onChange={e => setCliForm({ ...cliForm, name: e.target.value })}
                placeholder="My CLI Test Suite"
              />
              {errors.name && <span className="error">{errors.name}</span>}
              <span className="hint">You'll upload the executable when running tests</span>
            </div>

            <div className="modal-actions">
              <button className="btn-back" onClick={() => setStep('choose')}>Back</button>
              <button className="btn-submit" onClick={handleCliSubmit} disabled={isSubmitting}>
                Create Test Suite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
