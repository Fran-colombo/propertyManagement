import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import Transactions from "./pages/Transactions";
import PropertiesAndGarages from "./pages/PropertiesAndGarage";
import ContractsTable from "./pages/Contracts";
import AllContracts from "./pages/AllContracts";
import AuthProvider from "../context/AuthProvider";
import Login from "./pages/Login";
import PrivateRoute from "../routes/PrivateRoute";
import './App.css';




function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/people"
            element={
              <PrivateRoute>
                <Layout>
                  <People />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/properties"
            element={
              <PrivateRoute>
                <Layout>
                  <PropertiesAndGarages />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <PrivateRoute>
                <Layout>
                  <Transactions />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <PrivateRoute>
                <Layout>
                  <ContractsTable />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/all-contracts"
            element={
              <PrivateRoute>
                <Layout>
                  <AllContracts />
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
