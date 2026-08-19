package main

import (
	"net/http"
	"path/filepath"

	tmplConfig "github.com/randallmlough/resume-builder/internal/config"
	"github.com/randallmlough/resume-builder/internal/request"
	"github.com/randallmlough/resume-builder/internal/response"
	"github.com/randallmlough/resume-builder/internal/resume"
	"github.com/randallmlough/resume-builder/internal/util"
)

func (app *application) status(w http.ResponseWriter, r *http.Request) {
	data := map[string]string{
		"Status": "OK",
	}

	err := response.JSON(w, http.StatusOK, data)
	if err != nil {
		app.serverError(w, r, err)
	}
}

type CoverLetterRequest struct {
	Body string `json:"body"`
}

func (app *application) generateCoverLetter(w http.ResponseWriter, r *http.Request) {
	input := CoverLetterRequest{}
	if err := request.DecodeJSONStrict(w, r, &input); err != nil {
		app.serverError(w, r, err)
		return
	}

	cfg, err := tmplConfig.LoadConfig()
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	dir, err := util.GetProjectPath()
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	resumeData := filepath.Join(filepath.Dir(dir), "resume.json")
	personalDetails, err := resume.LoadPersonalDetails(resumeData)
	if err != nil {
		app.serverError(w, r, err)
		return
	}
	data := resume.LatexTemplateData{
		Resume: personalDetails,
		Config: cfg,
		Body:   input.Body,
	}
	filename := filepath.Join(filepath.Dir(dir), "cover-letter.tex")
	if err := resume.CreateTexFile("cover-letter", filename, data); err != nil {
		app.serverError(w, r, err)
		return
	}

	if err := response.JSON(w, http.StatusOK, nil); err != nil {
		app.serverError(w, r, err)
		return
	}
}

type BuildResumeRequest struct {
	CoverLetter struct {
		DataSrc  string `json:"data_src"`
		Template string `json:"template"`
	} `json:"cover_letter,omitzero"`
	Resume struct {
		Template string `json:"template"`
	}
}

func (app *application) buildResume(w http.ResponseWriter, r *http.Request) {
	input := BuildResumeRequest{}
	if err := request.DecodeJSONStrict(w, r, &input); err != nil {
		app.serverError(w, r, err)
		return
	}

	cfg, err := tmplConfig.LoadConfig()
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	dir, err := util.GetProjectPath()
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	filename := filepath.Join(filepath.Dir(dir), "resume.json")
	personalDetails, err := resume.LoadPersonalDetails(filename)
	if err != nil {
		app.serverError(w, r, err)
		return
	}
	if input.CoverLetter.DataSrc != "" {
		body, err := resume.LoadMarkdownFile(input.CoverLetter.DataSrc)
		if err != nil {
			app.serverError(w, r, err)
			return
		}
		data := resume.LatexTemplateData{
			Resume: personalDetails,
			Config: cfg,
			Body:   body,
		}
		outputPath := filepath.Join(filepath.Dir(dir), "cover-letter.tex")
		if err := resume.CreateTexFile(input.CoverLetter.Template, outputPath, data); err != nil {
			app.serverError(w, r, err)
			return
		}
	}

	if err := response.JSON(w, http.StatusOK, nil); err != nil {
		app.serverError(w, r, err)
		return
	}
}
