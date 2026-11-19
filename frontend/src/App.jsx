import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { api } from "./api.js";
import { auth, googleProvider } from "./firebase.js";

const STATUSES = ["pendiente", "enviado", "entregado", "cancelado"];
const money = (n) => Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
    } catch (err) {
      setError(err.code || err.message);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-1 text-center">TiendaNube</h1>
      <p className="text-muted text-center mb-4">Catálogo y pedidos</p>
      <form onSubmit={submit} className="card card-body shadow-sm">
        <input className="form-control mb-2" type="email" placeholder="Correo" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="form-control mb-3" type="password" placeholder="Contraseña" required
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn btn-primary mb-2">Ingresar</button>
        <button type="button" className="btn btn-outline-dark"
          onClick={() => signInWithPopup(auth, googleProvider).catch((err) => setError(err.code))}>
          Ingresar con Google
        </button>
        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
      </form>
    </div>
  );
}

function Products({ products, error, reload, notify }) {
  const empty = { name: "", category: "", price: "", stock: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createProduct({ ...form, price: Number(form.price), stock: Number(form.stock) });
      setForm(empty);
      notify("success", "Producto guardado en MongoDB Atlas");
      reload();
    } catch (err) {
      notify("danger", err.message);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        <form onSubmit={submit} className="card card-body">
          <h2 className="h5">Nuevo producto</h2>
          {["name:Nombre", "category:Categoría", "price:Precio", "stock:Stock"].map((f) => {
            const [key, label] = f.split(":");
            return (
              <input key={key} className="form-control mb-2" placeholder={label} required
                type={key === "price" || key === "stock" ? "number" : "text"} min="0"
                value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            );
          })}
          <button className="btn btn-primary">Guardar</button>
        </form>
      </div>
      <div className="col-lg-8">
        <SectionError error={error} />
        <table className="table table-striped align-middle">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock}</td></tr>
            ))}
            {!products.length && <tr><td colSpan="4" className="text-muted">Sin productos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Customers({ customers, error, reload, notify }) {
  const empty = { name: "", email: "", phone: "", city: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createCustomer(form);
      setForm(empty);
      notify("success", "Cliente guardado en MongoDB Atlas (base tienda_clientes)");
      reload();
    } catch (err) {
      notify("danger", err.message);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        <form onSubmit={submit} className="card card-body">
          <h2 className="h5">Nuevo cliente</h2>
          {["name:Nombre", "email:Correo", "phone:Teléfono", "city:Ciudad"].map((f) => {
            const [key, label] = f.split(":");
            return (
              <input key={key} className="form-control mb-2" placeholder={label}
                required={key === "name" || key === "email"} type={key === "email" ? "email" : "text"}
                value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            );
          })}
          <button className="btn btn-primary">Guardar</button>
        </form>
      </div>
      <div className="col-lg-8">
        <SectionError error={error} />
        <table className="table table-striped align-middle">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Ciudad</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td><td>{c.city}</td></tr>
            ))}
            {!customers.length && <tr><td colSpan="4" className="text-muted">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionError({ error }) {
  return error ? <div className="alert alert-warning">⚠️ {error}</div> : null;
}

const SERVICE_LABELS = { products: "Productos", orders: "Pedidos", customers: "Clientes" };

function StatusBar({ status }) {
  return (
    <div className="d-flex gap-2 mb-3 small align-items-center">
      <span className="text-muted">Microservicios:</span>
      {Object.entries(SERVICE_LABELS).map(([key, label]) => {
        const state = status?.[key];
        const color = state === "up" ? "success" : state === "down" ? "danger" : "secondary";
        return (
          <span key={key} className={`badge text-bg-${color}`}>
            {label}: {state === "up" ? "activo" : state === "down" ? "caído" : "…"}
          </span>
        );
      })}
    </div>
  );
}

function Orders({ products, customers, orders, error, reload, notify }) {
  const empty = { product_id: "", quantity: 1, customer_name: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createOrder({ ...form, quantity: Number(form.quantity) });
      setForm(empty);
      notify("success", "Pedido guardado en Oracle y stock descontado en MongoDB");
      reload();
    } catch (err) {
      notify("danger", err.message);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status);
      notify("success", `Pedido ${id} actualizado a "${status}"`);
      reload();
    } catch (err) {
      notify("danger", err.message);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-4">
        <form onSubmit={submit} className="card card-body">
          <h2 className="h5">Nuevo pedido</h2>
          <select className="form-select mb-2" required value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Seleccione un producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>
            ))}
          </select>
          <input className="form-control mb-2" type="number" min="1" placeholder="Cantidad" required
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className="form-control mb-2" placeholder="Nombre del cliente" required list="customer-names"
            value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          <datalist id="customer-names">
            {customers.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
          <button className="btn btn-success">Crear pedido</button>
        </form>
      </div>
      <div className="col-lg-8">
        <SectionError error={error} />
        <table className="table table-striped align-middle">
          <thead><tr><th>#</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Cliente</th><th>Estado</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td><td>{o.product_name}</td><td>{o.quantity}</td>
                <td>{money(o.total)}</td><td>{o.customer_name}</td>
                <td>
                  <select className="form-select form-select-sm" value={o.status}
                    onChange={(e) => changeStatus(o.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan="6" className="text-muted">Sin pedidos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const notify = (type, text) => setMessage({ type, text });

  // Cada microservicio se carga por separado: si uno está caído,
  // solo su sección muestra el error y las demás siguen funcionando.
  const reload = async () => {
    const [p, o, c] = await Promise.allSettled([api.listProducts(), api.listOrders(), api.listCustomers()]);
    if (p.status === "fulfilled") setProducts(p.value);
    if (o.status === "fulfilled") setOrders(o.value);
    if (c.status === "fulfilled") setCustomers(c.value);
    setErrors({
      products: p.status === "rejected" ? p.reason.message : "",
      orders: o.status === "rejected" ? o.reason.message : "",
      customers: c.status === "rejected" ? c.reason.message : "",
    });
  };

  useEffect(() => {
    if (!user) return undefined;
    reload();
    // Revisa el estado de los microservicios cada 5 segundos
    const check = () => api.servicesStatus().then(setStatus).catch(() => setStatus(null));
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [user]);

  if (user === undefined) return <p className="p-5 text-center">Cargando…</p>;
  if (!user) return <Login />;

  return (
    <>
      <nav className="navbar navbar-dark bg-dark px-3">
        <span className="navbar-brand">TiendaNube</span>
        <span className="text-light small">
          {user.email}
          <button className="btn btn-sm btn-outline-light ms-3" onClick={() => signOut(auth)}>Salir</button>
        </span>
      </nav>
      <div className="container py-4">
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button className={`nav-link ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>
              Productos (MongoDB)
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>
              Pedidos (Oracle)
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>
              Clientes (MongoDB)
            </button>
          </li>
          <li className="nav-item ms-auto">
            <button className="btn btn-sm btn-outline-secondary mt-1" onClick={reload}>Recargar</button>
          </li>
        </ul>
        <StatusBar status={status} />
        {message && (
          <div className={`alert alert-${message.type} alert-dismissible`}>
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage(null)} />
          </div>
        )}
        {tab === "products" && <Products products={products} error={errors.products} reload={reload} notify={notify} />}
        {tab === "orders" && (
          <Orders products={products} customers={customers} orders={orders}
            error={errors.orders} reload={reload} notify={notify} />
        )}
        {tab === "customers" && <Customers customers={customers} error={errors.customers} reload={reload} notify={notify} />}
      </div>
    </>
  );
}
