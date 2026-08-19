package resume

import (
	"strings"
	"testing"

	"github.com/randallmlough/resume-builder/internal/config"
)

func TestVisibleExperienceFiltersHiddenJobs(t *testing.T) {
	jobs := []Job{
		{Company: "Visible One"},
		{Company: "Hidden", Hide: true},
		{Company: "Visible Two"},
	}

	got := visibleExperience(jobs)

	if len(got) != 2 {
		t.Fatalf("expected 2 visible jobs, got %d", len(got))
	}
	if got[0].Company != "Visible One" {
		t.Errorf("expected first visible company to be %q, got %q", "Visible One", got[0].Company)
	}
	if got[1].Company != "Visible Two" {
		t.Errorf("expected second visible company to be %q, got %q", "Visible Two", got[1].Company)
	}
}

func TestVisibleExperienceReturnsEmptySliceWhenAllJobsAreHidden(t *testing.T) {
	jobs := []Job{
		{Company: "Hidden One", Hide: true},
		{Company: "Hidden Two", Hide: true},
	}

	got := visibleExperience(jobs)

	if len(got) != 0 {
		t.Fatalf("expected no visible jobs, got %d", len(got))
	}
}

func TestSingleColumnTemplateSkipsHiddenExperience(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Experience: []Job{
			{
				Company: "Visible Company",
				Positions: []Position{
					{
						Title:            "Visible Role",
						StartDate:        "January 2024",
						EndDate:          "Present",
						Responsibilities: []string{"Visible work"},
					},
				},
			},
			{
				Company: "Hidden Company",
				Hide:    true,
				Positions: []Position{
					{
						Title:            "Hidden Role",
						StartDate:        "January 2023",
						EndDate:          "December 2023",
						Responsibilities: []string{"Hidden work"},
					},
				},
			},
		},
	}
	cfg := &config.Config{
		AccentColor: "1f79c7",
		MutedColor:  "5a5a5a",
	}

	got, err := GenerateLaTeX("single-column", funcMap, Data{
		Resume: resume,
		Config: cfg,
	})
	if err != nil {
		t.Fatalf("expected template to render, got error: %v", err)
	}

	if !strings.Contains(got, "Visible Company") {
		t.Errorf("expected rendered resume to include visible company")
	}
	if strings.Contains(got, "Hidden Company") {
		t.Errorf("expected rendered resume to exclude hidden company")
	}
}

func TestSingleColumnTemplateOmitsExperienceSectionWhenAllExperienceIsHidden(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Experience: []Job{
			{
				Company: "Hidden Company",
				Hide:    true,
				Positions: []Position{
					{
						Title:            "Hidden Role",
						StartDate:        "January 2023",
						EndDate:          "December 2023",
						Responsibilities: []string{"Hidden work"},
					},
				},
			},
		},
	}
	cfg := &config.Config{
		AccentColor: "1f79c7",
		MutedColor:  "5a5a5a",
	}

	got, err := GenerateLaTeX("single-column", funcMap, Data{
		Resume: resume,
		Config: cfg,
	})
	if err != nil {
		t.Fatalf("expected template to render, got error: %v", err)
	}

	if strings.Contains(got, `\section{Experience}`) {
		t.Errorf("expected rendered resume to omit experience section when all jobs are hidden")
	}
	if strings.Contains(got, "Hidden Company") {
		t.Errorf("expected rendered resume to exclude hidden company")
	}
}
