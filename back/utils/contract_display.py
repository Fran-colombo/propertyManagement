from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def property_display_label(prop) -> str:
    if prop is None:
        return "Sin dirección"
    parts = [prop.direction] if getattr(prop, "direction", None) else []
    if getattr(prop, "floor", None):
        parts.append(f"Piso {prop.floor}")
    if getattr(prop, "apartment", None):
        parts.append(f"Depto {prop.apartment}")
    return " · ".join(parts) if parts else "Sin dirección"


def contract_location_label(contract) -> str:
    if contract is None:
        return "Sin dirección"
    if getattr(contract, "property", None) and contract.property.direction:
        return property_display_label(contract.property)
    garage = getattr(contract, "garage", None)
    if garage:
        label = f"Garage N° {garage.number}"
        associated = property_display_label(garage.property) if getattr(garage, "property", None) else None
        if associated and associated != "Sin dirección":
            label += f" ({associated})"
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


def month_start(day: date) -> date:
    return date(day.year, day.month, 1)


def month_end(day: date) -> date:
    return month_start(day) + relativedelta(months=1) - timedelta(days=1)


def iter_months(start: date, end: date):
    current = month_start(start)
    last = month_start(end)
    while current <= last:
        yield current, month_end(current)
        current += relativedelta(months=1)
