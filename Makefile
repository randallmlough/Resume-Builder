# ==================================================================================== #
# COMMANDS
# ==================================================================================== #

##@ Commands

.PHONY: build
build: clean gen create_pdf ## Run development application *common*

.PHONY: gen
gen:  ## Generate Tex file *common*
	@echo 'Generating Tex file'
	@go run .

.PHONY: create_pdf
create_pdf: clean build_image ## Create PDF
	@echo 'Creating PDF resume file'
	@docker run --rm -i -v "$(shell pwd)":/data resume/latex lualatex -output-directory=dist resume.tex

.PHONY: build_image
build_image: ## Build Docker image
	@docker build -t resume/latex .

.PHONY: clean
clean:  ## Removes contents from the dist directory *common*
	@echo 'Cleaning dist directory'
	@rm -rf dist/*

.PHONY: fonts
fonts: ## Build Docker image
	docker run --rm -it resume/latex luaotfload-tool --list=basename

#docker run --rm -it resume/latex fc-list | grep -i

# ==================================================================================== #
# UTILITIES
# ==================================================================================== #

##@ Utility
.PHONY: help
help:  ## Display this help
	@printf "Usage:\n  make \033[36m<target>\033[0m\n\n"
	@awk 'BEGIN {FS = ":.*##"; common_header_printed = 0;} \
        /^[a-zA-Z0-9._%-]+:.*?##.*\*common\*/ { \
            if (common_header_printed == 0) { \
                printf "\033[1mCommon\033[0m\n"; \
                common_header_printed = 1; \
            } \
            target = $$1; desc = $$2; \
            gsub(/\s*\*common\*/, "", desc); \
            gsub(/^[[:space:]]+|[[:space:]]+$$/, "", desc); \
            printf "  \033[36m%-15s\033[0m %s\n", target, desc; \
        } \
        END { if (common_header_printed == 1); }' $(MAKEFILE_LIST)
	@awk 'BEGIN {FS = ":.*##";} \
        /^##@/ { \
            printf "\n"; \
            printf "\033[1m%s\033[0m\n", substr($$0, 5); \
        } \
        /^[a-zA-Z0-9._%-]+:.*?##/ { \
            target = $$1; desc = $$2; \
            gsub(/\s*\*common\*/, "", desc); \
            gsub(/^[[:space:]]+|[[:space:]]+$$/, "", desc); \
            printf "  \033[36m%-15s\033[0m %s\n", target, desc; \
        }' $(MAKEFILE_LIST)