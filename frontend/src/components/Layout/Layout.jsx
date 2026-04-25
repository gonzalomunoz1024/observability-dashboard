import { Header } from './Header';
import './Layout.css';

export function Layout({ children, onAddService }) {
  return (
    <div className="layout">
      <Header onAddService={onAddService} />
      <main className="main-content">{children}</main>
    </div>
  );
}
