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

func TestVisibleProjectsFiltersHiddenProjects(t *testing.T) {
	projects := []Project{
		{Name: "Visible One"},
		{Name: "Hidden", Hide: true},
		{Name: "Visible Two"},
	}

	got := visibleProjects(projects)

	if len(got) != 2 {
		t.Fatalf("expected 2 visible projects, got %d", len(got))
	}
	if got[0].Name != "Visible One" {
		t.Errorf("expected first visible project to be %q, got %q", "Visible One", got[0].Name)
	}
	if got[1].Name != "Visible Two" {
		t.Errorf("expected second visible project to be %q, got %q", "Visible Two", got[1].Name)
	}
}

func TestVisibleEducationFiltersHiddenEducation(t *testing.T) {
	education := []Education{
		{Institution: "Visible One"},
		{Institution: "Hidden", Hide: true},
		{Institution: "Visible Two"},
	}

	got := visibleEducation(education)

	if len(got) != 2 {
		t.Fatalf("expected 2 visible education entries, got %d", len(got))
	}
	if got[0].Institution != "Visible One" {
		t.Errorf("expected first visible education entry to be %q, got %q", "Visible One", got[0].Institution)
	}
	if got[1].Institution != "Visible Two" {
		t.Errorf("expected second visible education entry to be %q, got %q", "Visible Two", got[1].Institution)
	}
}

func TestSingleColumnTemplatePageMarkerVisibility(t *testing.T) {
	resume := &PersonalDetail{Name: "Test Person"}

	tests := []struct {
		name       string
		pageMarker config.BaseSection
		wantMarker bool
	}{
		{
			name:       "shown by default",
			pageMarker: config.BaseSection{},
			wantMarker: true,
		},
		{
			name:       "hidden by config",
			pageMarker: config.BaseSection{Hide: true},
			wantMarker: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{
				AccentColor: "1f79c7",
				MutedColor:  "5a5a5a",
				PageMarker:  tt.pageMarker,
			}

			got, err := GenerateLaTeX("single-column", funcMap, Data{
				Resume: resume,
				Config: cfg,
			})
			if err != nil {
				t.Fatalf("expected template to render, got error: %v", err)
			}

			hasMarker := strings.Contains(got, `\fancyfoot[C]`)
			if hasMarker != tt.wantMarker {
				t.Errorf("page marker presence = %t, want %t", hasMarker, tt.wantMarker)
			}
		})
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

func TestSingleColumnTemplateSkipsHiddenProjects(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Projects: []Project{
			{
				Name:       "Visible Project",
				Github:     "https://github.com/test/visible",
				Technology: []string{"Go"},
				Items:      []string{"Visible work"},
			},
			{
				Name:       "Hidden Project",
				Hide:       true,
				Github:     "https://github.com/test/hidden",
				Technology: []string{"Go"},
				Items:      []string{"Hidden work"},
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

	if !strings.Contains(got, "Visible Project") {
		t.Errorf("expected rendered resume to include visible project")
	}
	if strings.Contains(got, "Hidden Project") {
		t.Errorf("expected rendered resume to exclude hidden project")
	}
}

func TestSingleColumnTemplateProjectGitHubLinkVisibility(t *testing.T) {
	tests := []struct {
		name     string
		github   string
		wantLink bool
	}{
		{
			name:     "shown when URL is present",
			github:   "https://github.com/test/project",
			wantLink: true,
		},
		{
			name:     "hidden when URL is empty",
			github:   "",
			wantLink: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resume := &PersonalDetail{
				Name: "Test Person",
				Projects: []Project{
					{
						Name:       "Test Project",
						Github:     tt.github,
						Technology: []string{"Go"},
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

			hasLink := strings.Contains(got, `\underline{GitHub}`)
			if hasLink != tt.wantLink {
				t.Errorf("project GitHub link presence = %t, want %t", hasLink, tt.wantLink)
			}
		})
	}
}

func TestSingleColumnTemplateProjectWebsiteLink(t *testing.T) {
	tests := []struct {
		name          string
		website       string
		github        string
		wantWebsite   bool
		wantSeparator bool
	}{
		{name: "website only", website: "https://example.com", wantWebsite: true},
		{name: "website and github", website: "https://example.com", github: "https://github.com/test/project", wantWebsite: true, wantSeparator: true},
		{name: "no website", github: "https://github.com/test/project"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resume := &PersonalDetail{
				Name: "Test Person",
				Projects: []Project{
					{
						Name:       "Test Project",
						Website:    tt.website,
						Github:     tt.github,
						Technology: []string{"Go"},
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

			hasWebsite := strings.Contains(got, `\href{https://example.com}{\underline{Website}}`)
			if hasWebsite != tt.wantWebsite {
				t.Errorf("project website link presence = %t, want %t", hasWebsite, tt.wantWebsite)
			}
			hasSeparator := strings.Contains(got, `{\underline{Website}} $|$ \href`)
			if hasSeparator != tt.wantSeparator {
				t.Errorf("website/github separator presence = %t, want %t", hasSeparator, tt.wantSeparator)
			}
		})
	}
}

func TestSingleColumnTemplateResumeItemTrimsTrailingSpace(t *testing.T) {
	cfg := &config.Config{AccentColor: "1f79c7", MutedColor: "5a5a5a"}
	got, err := GenerateLaTeX("single-column", funcMap, Data{
		Resume: &PersonalDetail{Name: "Test Person"},
		Config: cfg,
	})
	if err != nil {
		t.Fatalf("expected template to render, got error: %v", err)
	}
	// A trailing space before \vspace inside \resumeItem produces a blank line
	// when a bullet exactly fills the line width.
	if !strings.Contains(got, `{#1\unskip\vspace{-2pt}}%`) {
		t.Errorf("expected \\resumeItem to unskip trailing space before \\vspace")
	}
}

func TestSingleColumnTemplateOmitsProjectsSectionWhenAllProjectsAreHidden(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Projects: []Project{
			{
				Name:       "Hidden Project",
				Hide:       true,
				Github:     "https://github.com/test/hidden",
				Technology: []string{"Go"},
				Items:      []string{"Hidden work"},
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

	if strings.Contains(got, `\section{Projects}`) {
		t.Errorf("expected rendered resume to omit projects section when all projects are hidden")
	}
	if strings.Contains(got, "Hidden Project") {
		t.Errorf("expected rendered resume to exclude hidden project")
	}
}

func TestSingleColumnTemplateSkipsHiddenEducation(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Education: []Education{
			{
				Institution: "Visible University",
				Degree:      "Visible Degree",
				StartDate:   "2020",
				EndDate:     "2024",
			},
			{
				Institution: "Hidden University",
				Hide:        true,
				Degree:      "Hidden Degree",
				StartDate:   "2016",
				EndDate:     "2020",
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

	if !strings.Contains(got, "Visible University") {
		t.Errorf("expected rendered resume to include visible education")
	}
	if strings.Contains(got, "Hidden University") {
		t.Errorf("expected rendered resume to exclude hidden education")
	}
}

func TestSingleColumnTemplateOmitsEducationSectionWhenAllEducationIsHidden(t *testing.T) {
	resume := &PersonalDetail{
		Name: "Test Person",
		Contact: Contact{
			Email:    "test@example.com",
			Phone:    "555-555-5555",
			LinkedIn: "linkedin.com/in/test",
			GitHub:   "github.com/test",
		},
		Summary: "Summary",
		Education: []Education{
			{
				Institution: "Hidden University",
				Hide:        true,
				Degree:      "Hidden Degree",
				StartDate:   "2016",
				EndDate:     "2020",
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

	if strings.Contains(got, `\section{Education}`) {
		t.Errorf("expected rendered resume to omit education section when all education is hidden")
	}
	if strings.Contains(got, "Hidden University") {
		t.Errorf("expected rendered resume to exclude hidden education")
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
