import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page counts.
    Also draws header and footer lines on all pages except the cover page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Skip page decorations on cover page
            return

        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header
        self.drawString(54, 750, "AI DATASET CLEANING PLATFORM — OPERATIONS REPORT")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 45, page_text)
        self.drawString(54, 45, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.line(54, 58, 558, 58)
        self.restoreState()


class PDFReportGenerator:
    @staticmethod
    def generate_report(dest_path: str, dataset_name: str, report_data: dict, session_data: dict, stats_compare: list):
        """
        Creates a PDF cleaning report.
        """
        doc = SimpleDocTemplate(
            dest_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()
        
        # Define brand custom palette colors
        primary_color = colors.HexColor("#0F172A")    # Deep slate
        accent_color = colors.HexColor("#3B82F6")     # Brand blue
        alert_amber = colors.HexColor("#D97706")      # Amber alert
        text_dark = colors.HexColor("#334155")        # Slate-700
        border_light = colors.HexColor("#E2E8F0")

        # Custom Paragraph Styles
        styles.add(ParagraphStyle(
            name='CoverTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=32,
            leading=38,
            textColor=primary_color,
            spaceAfter=15
        ))
        
        styles.add(ParagraphStyle(
            name='CoverSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=14,
            leading=18,
            textColor=accent_color,
            spaceAfter=40
        ))

        styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
            textColor=primary_color,
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        ))

        styles.add(ParagraphStyle(
            name='SubSectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=15,
            textColor=accent_color,
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True
        ))

        styles.add(ParagraphStyle(
            name='BodyPara',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=text_dark,
            spaceAfter=8
        ))

        styles.add(ParagraphStyle(
            name='TableText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=11,
            textColor=text_dark
        ))

        styles.add(ParagraphStyle(
            name='TableHeaderText',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.white
        ))

        story = []

        # =========================================================================
        # 1. COVER PAGE
        # =========================================================================
        story.append(Spacer(1, 100))
        story.append(Paragraph("AI Dataset Cleaning & Quality Report", styles['CoverTitle']))
        story.append(Paragraph(f"Dataset File: {dataset_name}", styles['CoverSubtitle']))
        
        # Cover Metadata block
        meta_data = [
            [Paragraph("<b>Session ID:</b>", styles['BodyPara']), Paragraph(session_data.get('id', 'N/A'), styles['BodyPara'])],
            [Paragraph("<b>Quality Score Before:</b>", styles['BodyPara']), Paragraph(f"{session_data.get('quality_score_before')}/100", styles['BodyPara'])],
            [Paragraph("<b>Quality Score After:</b>", styles['BodyPara']), Paragraph(f"{session_data.get('quality_score_after')}/100", styles['BodyPara'])],
            [Paragraph("<b>Execution Time:</b>", styles['BodyPara']), Paragraph(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), styles['BodyPara'])]
        ]
        meta_table = Table(meta_data, colWidths=[200, 304])
        meta_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, border_light),
        ]))
        story.append(meta_table)
        
        story.append(Spacer(1, 60))
        story.append(Paragraph("<b>Confidentiality & Compliance Notice</b><br/>"
                               "This report outlines automated data cleaning operations executing on proprietary files. "
                               "All code transformations, parsing summaries, and metrics modifications are logged for audit purposes.", styles['BodyPara']))
        
        story.append(PageBreak())

        # =========================================================================
        # 2. EXECUTIVE SUMMARY
        # =========================================================================
        story.append(Paragraph("Executive Summary", styles['SectionHeading']))
        story.append(Paragraph(report_data.get('executive_summary', ''), styles['BodyPara']))
        story.append(Spacer(1, 10))

        # Before vs After table breakdown
        story.append(Paragraph("Clean Metrics Comparison", styles['SubSectionHeading']))
        compare_rows = [[
            Paragraph("Metric", styles['TableHeaderText']),
            Paragraph("Before Cleaning", styles['TableHeaderText']),
            Paragraph("After Cleaning", styles['TableHeaderText']),
            Paragraph("Variance", styles['TableHeaderText'])
        ]]
        
        for metric_item in stats_compare:
            # Format display
            bef = str(metric_item.get('before'))
            aft = str(metric_item.get('after'))
            var = str(metric_item.get('pct_impr', '0'))
            if var not in ['N/A', '0'] and not var.startswith('-') and var != '0%':
                var = f"+{var}%"
            elif var != 'N/A' and var != '0':
                var = f"{var}%"

            compare_rows.append([
                Paragraph(metric_item.get('metric', '').replace('_', ' ').title(), styles['TableText']),
                Paragraph(bef, styles['TableText']),
                Paragraph(aft, styles['TableText']),
                Paragraph(var, styles['TableText'])
            ])

        compare_table = Table(compare_rows, colWidths=[150, 118, 118, 118])
        compare_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), primary_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, border_light),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        story.append(compare_table)
        story.append(Spacer(1, 15))

        # =========================================================================
        # 3. PROBLEMS ENCOUNTERED & EXPLANATIONS
        # =========================================================================
        story.append(Paragraph("Dataset Quality Inspection Detail", styles['SectionHeading']))
        problems = report_data.get('problems_found', [])
        
        if not problems:
            story.append(Paragraph("<i>No significant dataset structure problems encountered during automated inspection.</i>", styles['BodyPara']))
        else:
            prob_rows = [[
                Paragraph("Column Target", styles['TableHeaderText']),
                Paragraph("Defect / Finding Description", styles['TableHeaderText']),
                Paragraph("Proposed Mitigation Recommendation", styles['TableHeaderText'])
            ]]
            for p in problems:
                if hasattr(p, 'column'):
                    col_name = p.column or 'Global Schema'
                    desc = p.description or ''
                    rec = p.recommendation or ''
                elif isinstance(p, dict):
                    col_name = p.get('column') or 'Global Schema'
                    desc = p.get('description', '')
                    rec = p.get('recommendation', '')
                else:
                    col_name = 'Global Schema'
                    desc = str(p)
                    rec = ''

                prob_rows.append([
                    Paragraph(f"<b>{col_name}</b>", styles['TableText']),
                    Paragraph(desc, styles['TableText']),
                    Paragraph(rec, styles['TableText'])
                ])
            
            prob_table = Table(prob_rows, colWidths=[110, 204, 190])
            prob_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), primary_color),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, border_light),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFFBEB")]), # Light amber
            ]))
            story.append(prob_table)

        story.append(Spacer(1, 15))

        # =========================================================================
        # 4. ACTIONS TAKEN & PIPELINE LOGS
        # =========================================================================
        story.append(Paragraph("Cleaning Log & Actions Executed", styles['SectionHeading']))
        actions = report_data.get('actions_taken', [])

        if not actions:
            story.append(Paragraph("<i>No cleaning actions were executed during session processing.</i>", styles['BodyPara']))
        else:
            action_rows = [[
                Paragraph("Cleaner Executed", styles['TableHeaderText']),
                Paragraph("Operation Parameters", styles['TableHeaderText']),
                Paragraph("Rows/Cells Affected", styles['TableHeaderText'])
            ]]
            for a in actions:
                cleaner = a.get('cleaner_name', '').replace('_', ' ').title()
                params = str(a.get('parameters', {}))
                affected = str(a.get('rows_affected', 0))
                action_rows.append([
                    Paragraph(f"<b>{cleaner}</b>", styles['TableText']),
                    Paragraph(params, styles['TableText']),
                    Paragraph(affected, styles['TableText'])
                ])

            action_table = Table(action_rows, colWidths=[150, 234, 120])
            action_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), primary_color),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, border_light),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0FDF4")]), # Light green
            ]))
            story.append(action_table)

        story.append(Spacer(1, 15))

        # =========================================================================
        # 5. FUTURE SUGGESTIONS
        # =========================================================================
        story.append(KeepTogether([
            Paragraph("Suggestions for Upstream Data Collection", styles['SectionHeading']),
            *[Paragraph(f"• {suggestion}", styles['BodyPara']) for suggestion in report_data.get('future_suggestions', [])]
        ]))

        # Compile PDF document
        doc.build(story, canvasmaker=NumberedCanvas)
