import unittest
from datetime import date

from services.siat_tgi_service import (
    SiatInstallment,
    build_tgi_charge,
    parse_siat_html,
)


def row(period, capital, interest, status, kind="Original"):
    return SiatInstallment(period, kind, capital, interest, status)


# Captura del SIAT: septiembre abonado, abril a agosto pendientes, octubre no exigible.
SCREENSHOT = [
    row("2026-11", 78185.49, 0, "no_exigible"),
    row("2026-10", 78185.49, 0, "no_exigible"),
    row("2026-09", 73232.07, 0, "abonado"),
    row("2026-08", 73232.07, 3893.22, "pendiente"),
    row("2026-07", 73232.07, 5705.58, "pendiente"),
    row("2026-06", 66914.05, 7237.34, "pendiente"),
    row("2026-05", 66914.05, 9016.01, "pendiente"),
    row("2026-04", 66914.05, 10917.35, "pendiente"),
    row("2026-03", 62040.17, 3771.07, "abonado", kind="Ajuste"),
]


class TgiChargeTests(unittest.TestCase):
    def test_on_time_plus_oldest_pending(self):
        charge = build_tgi_charge(SCREENSHOT, "2026-10", fetched_on=date(2026, 10, 8))
        self.assertEqual(charge["current"]["total"], 78185.49)
        self.assertEqual(charge["current"]["interest"], 0)
        self.assertEqual(charge["catchup"]["period"], "2026-04")
        self.assertEqual(charge["catchup"]["capital"], 66914.05)
        self.assertEqual(charge["catchup"]["interest"], 10917.35)
        self.assertEqual(charge["total"], round(78185.49 + 66914.05 + 10917.35, 2))

    def test_next_month_skips_already_assigned_catchup(self):
        charge = build_tgi_charge(
            SCREENSHOT,
            "2026-11",
            assigned={"2026-10", "2026-04"},
        )
        self.assertEqual(charge["catchup"]["period"], "2026-05")
        self.assertEqual(charge["current"]["total"], 78185.49)

    def test_current_month_already_overdue_still_adds_oldest_other(self):
        charge = build_tgi_charge(SCREENSHOT, "2026-08")
        self.assertEqual(charge["current"]["status"], "pendiente")
        self.assertEqual(charge["current"]["interest"], 3893.22)
        self.assertEqual(charge["catchup"]["period"], "2026-04")

    def test_locked_catchup_stays_after_it_is_paid_on_siat(self):
        paid = [item for item in SCREENSHOT if item.period != "2026-04"]
        paid.append(row("2026-04", 66914.05, 0, "abonado"))
        locked = {
            "period": "2026-04",
            "capital": 66914.05,
            "interest": 10917.35,
            "status": "pendiente",
            "total": 77831.40,
        }
        charge = build_tgi_charge(
            paid,
            "2026-10",
            locked_catchup=locked,
            locked_current={"period": "2026-10", "capital": 78185.49, "interest": 0, "total": 78185.49},
        )
        self.assertEqual(charge["catchup"]["period"], "2026-04")
        self.assertTrue(charge["catchup"]["kept"])
        self.assertEqual(charge["catchup"]["total"], 77831.40)
        self.assertNotEqual(charge["catchup"]["period"], "2026-05")

    def test_pending_adjustment_joins_the_same_month(self):
        rows = [
            row("2026-04", 100, 5, "pendiente"),
            row("2026-04", 10, 1, "pendiente", kind="Ajuste"),
            row("2026-10", 50, 0, "no_exigible"),
        ]
        charge = build_tgi_charge(rows, "2026-10")
        self.assertEqual(charge["catchup"]["capital"], 110)
        self.assertEqual(charge["catchup"]["interest"], 6)
        self.assertEqual(charge["catchup"]["total"], 116)

    def test_parse_siat_table(self):
        page = """
        <table>
          <tr>
            <td>2026-04</td><td></td><td>Original</td>
            <td>66.914,05</td><td>10/04/2026</td><td>10.917,35</td>
            <td>0,00</td><td></td><td>Pendiente de Pago</td><td>77.831,40</td>
          </tr>
          <tr>
            <td>2026-10</td><td>Original</td>
            <td>78.185,49</td><td>13/10/2026</td><td>0,00</td>
            <td>No Exigible</td><td>78.185,49</td>
          </tr>
          <tr>
            <td>2026-09</td><td>Original</td>
            <td>73.232,07</td><td>10/09/2026</td><td>0,00</td>
            <td>73.232,07</td><td>08/09/2026</td><td>Abonado</td><td>0,00</td>
          </tr>
        </table>
        """
        parsed = parse_siat_html(page)
        by_period = {item.period: item for item in parsed}
        self.assertEqual(by_period["2026-04"].status, "pendiente")
        self.assertEqual(by_period["2026-04"].capital, 66914.05)
        self.assertEqual(by_period["2026-04"].interest, 10917.35)
        self.assertEqual(by_period["2026-10"].status, "no_exigible")
        self.assertEqual(by_period["2026-10"].capital, 78185.49)
        self.assertEqual(by_period["2026-10"].interest, 0)
        self.assertEqual(by_period["2026-09"].status, "abonado")

    def test_parse_error_page_has_no_rows(self):
        page = '<UL class="error" id="strutsErrors"><LI>La cuenta ingresada es inexistente</LI></UL>'
        self.assertEqual(parse_siat_html(page), [])


if __name__ == "__main__":
    unittest.main()
