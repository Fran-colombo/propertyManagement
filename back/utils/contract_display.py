def contract_location_label(contract) -> str:
    if contract is None:
        return "Sin dirección"
    if getattr(contract, "property", None) and contract.property.direction:
        return contract.property.direction
    garage = getattr(contract, "garage", None)
    if garage:
        label = f"Garage N° {garage.number}"
        if getattr(garage, "property", None) and garage.property.direction:
            label += f" ({garage.property.direction})"
        return label
    return "Sin dirección"


def contract_owner(contract):
    if contract is None:
        return None
    if getattr(contract, "property", None) and contract.property.owner:
        return contract.property.owner
    garage = getattr(contract, "garage", None)
    if garage and getattr(garage, "owner", None):
        return garage.owner
    return None
