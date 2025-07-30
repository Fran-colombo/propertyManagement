"use client"

import { useState } from "react"
import { X, DollarSign } from "lucide-react"

const UpdateTaxesModal = ({ period, onClose, onUpdate }) => {
  const [taxes, setTaxes] = useState({
    epe_amount: period.epe_amount || 0,
    tgi_amount: period.tgi_amount || 0,
    api_amount: period.api_amount || 0,
    fire_proof_amount: period.fire_proof_amount || 0,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setTimeout(() => {
      onUpdate()
    }, 1000)
  }

  const handleInputChange = (field, value) => {
    setTaxes((prev) => ({
      ...prev,
      [field]: Number.parseFloat(value) || 0,
    }))
  }

  const totalTaxes = Object.values(taxes).reduce((sum, value) => sum + value, 0)
  const newTotal = period.indexed_amount + totalTaxes

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Actualizar Impuestos</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EPE</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={taxes.epe_amount}
                onChange={(e) => handleInputChange("epe_amount", e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TGI</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={taxes.tgi_amount}
                onChange={(e) => handleInputChange("tgi_amount", e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={taxes.api_amount}
                onChange={(e) => handleInputChange("api_amount", e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seguro contra incendio</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={taxes.fire_proof_amount}
                onChange={(e) => handleInputChange("fire_proof_amount", e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Precio indexado:</span>
              <span>${period.indexed_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Total impuestos:</span>
              <span>${totalTaxes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-gray-900">
              <span>Total a pagar:</span>
              <span>${newTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UpdateTaxesModal
